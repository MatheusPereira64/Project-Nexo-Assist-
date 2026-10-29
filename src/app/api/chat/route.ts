import { SESSION_MESSAGE_LIMIT } from "@/domain/types";
import { getCurrentUser } from "@/lib/auth";
import {
  countSessionMessages,
  getConversation,
  getConversationRecord,
  insertMessage,
  listMessages,
  listTicketsByRequester,
} from "@/db/repository";
import { noteEmployeeWaiting } from "@/services/desk";
import { runAgent } from "@/mastra/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "employee") {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  const body = (await request.json()) as { conversationId?: string; text?: string };
  const text = body.text?.trim() ?? "";
  const conversationId = body.conversationId ?? "";
  if (!text) return Response.json({ error: "Escreva uma mensagem." }, { status: 400 });
  const conversation = getConversationRecord(conversationId);
  if (!conversation || conversation.employeeId !== user.id) {
    return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      const finish = () => {
        const view = getConversation(conversationId);
        send({
          type: "done",
          conversation: view,
          messages: listMessages(conversationId),
          tickets: listTicketsByRequester(user.id),
          sessionCount: view ? countSessionMessages(conversationId, view.sessionStartedAt) : 0,
        });
        controller.close();
      };

      try {
        if (conversation.state === "with_agent") {
          const used = countSessionMessages(conversationId, conversation.sessionStartedAt);
          if (used >= SESSION_MESSAGE_LIMIT) {
            send({
              type: "error",
              message: `Esta sessão chegou a ${SESSION_MESSAGE_LIMIT} mensagens. Fale com um analista ou volte mais tarde para uma sessão nova.`,
            });
            controller.close();
            return;
          }
        }

        insertMessage({ conversationId, role: "user", authorName: user.name, content: text });

        if (conversation.state !== "with_agent") {
          noteEmployeeWaiting(conversationId);
          finish();
          return;
        }

        const history = listMessages(conversationId);
        const result = await runAgent({
          context: {
            userId: user.id,
            userName: user.name,
            department: user.department,
            conversationId,
            userText: text,
          },
          history,
          onToken: (token) => send({ type: "token", text: token }),
        });
        insertMessage({
          conversationId,
          role: "assistant",
          authorName: "Nexo Assist",
          content: result.content,
          chips: result.chips,
          trace: result.trace,
          blocks: result.blocks,
        });
        finish();
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Não consegui responder agora." });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
