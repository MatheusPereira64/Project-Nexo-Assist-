import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  countSessionMessages,
  getConversation,
  getConversationRecord,
  insertMessage,
  listConversations,
  listMessages,
  listTicketsByRequester,
  updateConversation,
} from "@/db/repository";
import { assumeConversation, analystReply, closeConversation, returnConversation, transferConversation } from "@/services/desk";
import { TicketServiceUnavailable, withTicketService } from "@/services/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await params;
  const conversation = getConversationRecord(id);
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  if (user.role === "employee" && conversation.employeeId !== user.id) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const body = (await request.json()) as { type?: string; text?: string };
  const actor = { id: user.id, role: user.role };

  try {
    if (body.type === "read" && user.role === "analyst") {
      updateConversation(id, { unreadForAnalyst: 0 });
    } else if (body.type === "assume") {
      assumeConversation(id, actor);
    } else if (body.type === "return") {
      returnConversation(id, actor);
    } else if (body.type === "close") {
      closeConversation(id, actor);
    } else if (body.type === "reply") {
      const text = body.text?.trim() ?? "";
      if (!text) return NextResponse.json({ error: "Escreva a resposta." }, { status: 400 });
      analystReply(id, actor, text);
    } else if (body.type === "transfer") {
      if (user.role !== "employee") return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
      if (conversation.state !== "with_agent") {
        return NextResponse.json({ error: "Essa conversa já está com o atendimento humano." }, { status: 409 });
      }
      const tickets = listTicketsByRequester(user.id);
      const overdue = tickets.some((ticket) => ticket.overdue);
      const critical = tickets.some((ticket) => ticket.priority === "critical" && ticket.status !== "resolved");
      insertMessage({
        conversationId: id,
        role: "user",
        authorName: user.name,
        content: "Quero falar com um analista.",
      });
      const result = await withTicketService(() =>
        transferConversation({
          conversationId: id,
          actor,
          userAsked: true,
          confidence: 90,
          priority: critical ? "critical" : overdue ? "medium" : null,
          overdue,
          summary: "A pessoa pediu para falar com um analista.",
          reason: "user_asked",
          ticketId: tickets.find((ticket) => ticket.overdue)?.id,
        }),
      );
      if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 });
      insertMessage({
        conversationId: id,
        role: "assistant",
        authorName: "Nexo Assist",
        content: `Encaminhei para o Suporte ${result.queue}. Um analista segue daqui, e eu fico pausado.`,
        chips: ["encaminhou para um analista"],
        trace: {
          understood: "A pessoa pediu um analista pelo botão da conversa.",
          action: `Transferir para o Suporte ${result.queue} e pausar o agent.`,
          confidence: 96,
          reason: "Pedido explícito. O agent não responde enquanto a conversa está com o analista.",
          tools: ["transfer-conversation"],
        },
      });
    } else {
      return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof TicketServiceUnavailable || error instanceof Error ? error.message : "Não foi possível concluir.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const view = getConversation(id);
  return NextResponse.json({
    conversation: view,
    messages: listMessages(id),
    tickets: listTicketsByRequester(conversation.employeeId),
    sessionCount: view ? countSessionMessages(id, view.sessionStartedAt) : 0,
    conversations: user.role === "analyst" ? listConversations() : undefined,
  });
}
