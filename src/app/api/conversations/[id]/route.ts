import { getCurrentUser } from "@/lib/auth";
import { countSessionMessages, getConversation, listMessages, listTicketsByRequester } from "@/db/repository";
import { rollSessionIfNewDay } from "@/services/desk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  if (user.role === "employee" && conversation.employeeId !== user.id) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }
  const recordStarted = rollSessionIfNewDay(id);
  return NextResponse.json({
    conversation: getConversation(id),
    messages: listMessages(id),
    tickets: listTicketsByRequester(conversation.employeeId),
    sessionCount: countSessionMessages(id, recordStarted),
  });
}
