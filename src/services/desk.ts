import type { Priority } from "@/domain/types";
import { isSameZonedDay } from "@/domain/sla";
import { shouldTransfer, type Actor } from "@/domain/policy";
import {
  getConversationRecord,
  getUserById,
  insertConversation,
  insertMessage,
  latestOpenConversation,
  updateConversation,
  updateTicket,
  listTicketsByRequester,
} from "@/db/repository";
import { assertTicketService } from "./tickets";

export function queueFor(priority: Priority | null, overdue: boolean, confidence: number | null): "N1" | "N2" {
  if (priority === "critical" || priority === "high" || overdue || (confidence !== null && confidence < 55)) return "N2";
  return "N1";
}

export function openEmployeeConversation(employeeId: string) {
  return latestOpenConversation(employeeId) ?? insertConversation({ employeeId });
}

export function transferConversation(input: {
  conversationId: string;
  actor: Actor;
  userAsked: boolean;
  confidence: number | null;
  priority: Priority | null;
  overdue: boolean;
  summary: string;
  reason: string;
  ticketId?: string | null;
}): { ok: true; queue: "N1" | "N2" } | { ok: false; message: string } {
  if (!shouldTransfer(input)) {
    return { ok: false, message: "Ainda não há motivo para chamar um analista. Posso seguir no chat." };
  }
  const conversation = getConversationRecord(input.conversationId);
  if (!conversation) return { ok: false, message: "Conversa não encontrada." };
  if (conversation.state === "waiting" || conversation.state === "with_analyst") {
    return { ok: true, queue: conversation.queue === "N1" ? "N1" : "N2" };
  }
  assertTicketService();
  const queue = queueFor(input.priority, input.overdue, input.confidence);
  const now = new Date().toISOString();
  updateConversation(input.conversationId, {
    state: "waiting",
    queue,
    summary: input.summary,
    confidence: input.confidence,
    transferReason: input.reason,
    analystId: null,
    updatedAt: now,
    unreadForAnalyst: conversation.unreadForAnalyst + 1,
  });
  if (input.ticketId) {
    const ticket = listTicketsByRequester(conversation.employeeId).find((item) => item.id === input.ticketId || item.code === input.ticketId);
    if (ticket && ticket.status !== "resolved") {
      updateTicket(ticket.id, { status: "waiting_analyst", updatedAt: now, conversationId: input.conversationId });
    }
  }
  insertMessage({
    conversationId: input.conversationId,
    role: "system",
    authorName: "Sistema",
    content: `Transferida para Suporte ${queue}`,
    createdAt: now,
  });
  return { ok: true, queue };
}

export function assumeConversation(conversationId: string, analyst: Actor): void {
  if (analyst.role !== "analyst") throw new Error("Só um analista assume a conversa.");
  const user = getUserById(analyst.id);
  if (!user?.available) throw new Error("Você está indisponível. Fique disponível para assumir.");
  const conversation = getConversationRecord(conversationId);
  if (!conversation) throw new Error("Conversa não encontrada.");
  if (conversation.state === "closed") throw new Error("Essa conversa já foi encerrada.");
  const now = new Date().toISOString();
  updateConversation(conversationId, {
    state: "with_analyst",
    analystId: analyst.id,
    unreadForAnalyst: 0,
    updatedAt: now,
  });
  insertMessage({
    conversationId,
    role: "system",
    authorName: "Sistema",
    content: `${user.name} assumiu · agent pausado`,
    createdAt: now,
  });
}

export function rollSessionIfNewDay(conversationId: string, now = new Date()): string {
  const conversation = getConversationRecord(conversationId);
  if (!conversation) return now.toISOString();
  if (conversation.state !== "with_agent" || isSameZonedDay(new Date(conversation.sessionStartedAt), now)) {
    return conversation.sessionStartedAt;
  }
  const started = now.toISOString();
  updateConversation(conversationId, { sessionStartedAt: started });
  return started;
}

export function returnConversation(conversationId: string, analyst: Actor): void {
  if (analyst.role !== "analyst") throw new Error("Só um analista devolve a conversa.");
  const now = new Date().toISOString();
  updateConversation(conversationId, {
    state: "with_agent",
    analystId: null,
    queue: null,
    sessionStartedAt: now,
    unreadForAnalyst: 0,
    updatedAt: now,
  });
  insertMessage({
    conversationId,
    role: "system",
    authorName: "Sistema",
    content: "Conversa devolvida ao Nexo Assist",
    createdAt: now,
  });
}

export function closeConversation(conversationId: string, analyst: Actor): void {
  if (analyst.role !== "analyst") throw new Error("Só um analista encerra o atendimento.");
  const now = new Date().toISOString();
  updateConversation(conversationId, {
    state: "closed",
    unreadForAnalyst: 0,
    updatedAt: now,
  });
  insertMessage({
    conversationId,
    role: "system",
    authorName: "Sistema",
    content: "Atendimento encerrado",
    createdAt: now,
  });
}

export function analystReply(conversationId: string, analyst: Actor, text: string): void {
  if (analyst.role !== "analyst") throw new Error("Só o analista responde por aqui.");
  const conversation = getConversationRecord(conversationId);
  if (!conversation || conversation.state !== "with_analyst" || conversation.analystId !== analyst.id) {
    throw new Error("Assuma o atendimento para responder.");
  }
  const user = getUserById(analyst.id);
  insertMessage({
    conversationId,
    role: "analyst",
    authorName: user?.name ?? "Analista",
    content: text.trim(),
  });
  updateConversation(conversationId, { unreadForAnalyst: 0 });
}

export function noteEmployeeWaiting(conversationId: string): void {
  const conversation = getConversationRecord(conversationId);
  if (!conversation) return;
  updateConversation(conversationId, { unreadForAnalyst: conversation.unreadForAnalyst + 1 });
}
