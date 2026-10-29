import { NextResponse } from "next/server";
import type { DraftInput } from "@/domain/policy";
import { getCurrentUser } from "@/lib/auth";
import { countSessionMessages, getConversation, getDraft, listMessages, listTicketsByRequester } from "@/db/repository";
import { cancelDraft, confirmDraft, editDraft, TicketServiceUnavailable, withTicketService } from "@/services/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await params;
  const draft = getDraft(id);
  if (!draft) return NextResponse.json({ error: "Rascunho não encontrado." }, { status: 404 });
  if (user.role === "employee" && draft.requesterId !== user.id) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }
  const body = (await request.json()) as { action?: string; patch?: Partial<DraftInput> };
  const actor = { id: user.id, role: user.role };

  try {
    if (body.action === "confirm") await withTicketService(() => confirmDraft(id, actor));
    else if (body.action === "cancel") cancelDraft(id, actor);
    else if (body.action === "edit") editDraft(id, actor, body.patch ?? {});
    else return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar o rascunho.";
    const status = error instanceof TicketServiceUnavailable ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  const conversation = getConversation(draft.conversationId);
  return NextResponse.json({
    conversation,
    messages: listMessages(draft.conversationId),
    tickets: listTicketsByRequester(draft.requesterId),
    sessionCount: conversation ? countSessionMessages(draft.conversationId, conversation.sessionStartedAt) : 0,
  });
}
