import { randomUUID } from "node:crypto";
import { IMPACT_LABEL, type Impact, type Priority, type TicketType } from "@/domain/types";
import { deadlineFor } from "@/domain/sla";
import {
  canReadTickets,
  duplicateDecision,
  isOutOfScope,
  missingDraftFields,
  pickDuplicate,
  type Actor,
  type DraftInput,
  type TicketSnapshot,
} from "@/domain/policy";
import type { DraftView, TicketView } from "@/domain/blocks";
import {
  findTicket,
  getDraft,
  getTicketById,
  insertDraft,
  insertMessage,
  insertTicket,
  listTicketsByRequester,
  messagesContainingDraft,
  nextTicketCode,
  replaceMessageBlocks,
  toTicketView,
  updateDraft,
  updateTicket,
  type DraftRecord,
  type TicketRecord,
} from "@/db/repository";

export class TicketServiceUnavailable extends Error {
  constructor() {
    super("O sistema de chamados está indisponível por alguns segundos.");
    this.name = "TicketServiceUnavailable";
  }
}

export class PrivacyError extends Error {
  constructor() {
    super("Chamados de outra pessoa não podem ser consultados.");
    this.name = "PrivacyError";
  }
}

type Mode = "always" | "never" | "intermittent";
let mode: Mode = "intermittent";
let downUntil = 0;

export function setTicketServiceMode(next: Mode): void {
  mode = next;
  downUntil = 0;
}

export function assertTicketService(): void {
  if (mode === "never") return;
  if (mode === "always" || Date.now() < downUntil) throw new TicketServiceUnavailable();
  if (Math.random() < 0.08) {
    downUntil = Date.now() + 1500;
    throw new TicketServiceUnavailable();
  }
}

export async function withTicketService<T>(fn: () => T): Promise<T> {
  try {
    assertTicketService();
    return fn();
  } catch (error) {
    if (!(error instanceof TicketServiceUnavailable) || mode === "always") throw error;
    const wait = Math.max(0, downUntil - Date.now()) + 40;
    await new Promise((resolve) => setTimeout(resolve, wait));
    assertTicketService();
    return fn();
  }
}

function snapshot(row: TicketRecord): TicketSnapshot {
  return {
    id: row.id,
    requesterId: row.requesterId,
    status: row.status,
    category: row.category,
    title: row.title,
    description: row.description,
    resolvedAt: row.resolvedAt,
  };
}

export function listTicketsFor(actor: Actor, requesterId: string, now = new Date()): TicketView[] {
  if (!canReadTickets(actor, requesterId)) throw new PrivacyError();
  assertTicketService();
  return listTicketsByRequester(requesterId, now);
}

export function readTicket(actor: Actor, idOrCode: string, now = new Date()): TicketView {
  assertTicketService();
  const row = findTicket(idOrCode);
  if (!row) throw new Error("Chamado não encontrado.");
  if (!canReadTickets(actor, row.requesterId)) throw new PrivacyError();
  return toTicketView(row, now);
}

export function saveDraft(input: {
  conversationId: string;
  requesterId: string;
  draft: DraftInput;
  now?: Date;
}): { draft: DraftRecord; view: DraftView; duplicate: "update" | "reopen" | "create" } {
  const missing = missingDraftFields(input.draft);
  if (missing.length) throw new Error(`Faltam dados no rascunho: ${missing.join(", ")}.`);
  if (isOutOfScope(`${input.draft.title}\n${input.draft.description}`)) {
    throw new Error("Esse assunto fica fora do service desk de TI.");
  }
  const now = input.now ?? new Date();
  const existing = listTicketsByRequester(input.requesterId, now).map((ticket) => ({
    id: ticket.id,
    requesterId: ticket.requesterId,
    status: ticket.status,
    category: ticket.category,
    title: ticket.title,
    description: ticket.description,
    resolvedAt: ticket.resolvedAt,
  }));
  const chosen = input.draft.existingTicketId
    ? existing.find((ticket) => ticket.id === input.draft.existingTicketId)
    : undefined;
  const match = chosen
    ? {
        ticket: chosen,
        decision: (chosen.status === "resolved" ? "reopen" : "update") as "reopen" | "update",
      }
    : pickDuplicate(existing, input.draft, now);
  const dueAt = deadlineFor(input.draft.priority, now).toISOString();
  const record = insertDraft({
    conversationId: input.conversationId,
    requesterId: input.requesterId,
    payload: { ...input.draft, dueAt, duplicateOf: match?.ticket.id ?? null, duplicateDecision: match?.decision ?? "create" },
  });
  return {
    draft: record,
    duplicate: match?.decision ?? "create",
    view: toDraftView(record, "pending"),
  };
}

type StoredPayload = DraftInput & { dueAt?: string; duplicateOf?: string | null; duplicateDecision?: "update" | "reopen" | "create"; resultCode?: string };

function toDraftView(record: DraftRecord, status: DraftView["status"], resultCode?: string): DraftView {
  const payload = JSON.parse(record.payload) as StoredPayload;
  return {
    draftId: record.id,
    code: record.code,
    status,
    title: payload.title,
    description: payload.description,
    category: payload.category,
    subcategory: null,
    priority: payload.priority,
    ticketType: payload.type,
    impact: payload.impact,
    dueAt: payload.dueAt ?? new Date().toISOString(),
    affectedLabel: IMPACT_LABEL[payload.impact],
    resultCode: resultCode ?? payload.resultCode,
  };
}

export function editDraft(draftId: string, actor: Actor, patch: Partial<DraftInput>): DraftView {
  const record = requirePending(draftId, actor);
  const payload = JSON.parse(record.payload) as StoredPayload;
  const next = { ...payload, ...patch };
  const missing = missingDraftFields(next);
  if (missing.length) throw new Error(`Faltam dados no rascunho: ${missing.join(", ")}.`);
  next.dueAt = deadlineFor(next.priority, new Date()).toISOString();
  updateDraft(draftId, { payload: JSON.stringify(next) });
  const view = toDraftView({ ...record, payload: JSON.stringify(next) }, "pending");
  syncDraftBlocks(draftId, view);
  return view;
}

export function cancelDraft(draftId: string, actor: Actor): DraftView {
  const record = requirePending(draftId, actor);
  updateDraft(draftId, { status: "cancelled" });
  const view = toDraftView(record, "cancelled");
  syncDraftBlocks(draftId, view);
  return view;
}

export function confirmDraft(draftId: string, actor: Actor, now = new Date()): { view: DraftView; ticket: TicketView; decision: "update" | "reopen" | "create" } {
  const record = requirePending(draftId, actor);
  assertTicketService();
  const payload = JSON.parse(record.payload) as StoredPayload;
  const missing = missingDraftFields(payload);
  if (missing.length) throw new Error(`Faltam dados no rascunho: ${missing.join(", ")}.`);
  if (isOutOfScope(`${payload.title}\n${payload.description}`)) {
    throw new Error("Esse assunto fica fora do service desk de TI.");
  }

  const owned = listTicketsByRequester(payload.requesterId, now);
  const snapshots = owned.map((ticket) => ({
    id: ticket.id,
    requesterId: ticket.requesterId,
    status: ticket.status,
    category: ticket.category,
    title: ticket.title,
    description: ticket.description,
    resolvedAt: ticket.resolvedAt,
  }));
  const linked = payload.existingTicketId
    ? snapshots.find((ticket) => ticket.id === payload.existingTicketId)
    : undefined;
  const linkedDecision = linked ? duplicateDecision(linked, payload, now) : "create";
  const match =
    linked && linkedDecision !== "create"
      ? { ticket: linked, decision: linkedDecision }
      : pickDuplicate(snapshots, payload, now);
  const decision = match?.decision ?? "create";
  const dueAt = deadlineFor(payload.priority, now).toISOString();
  let row: TicketRecord;

  if (match && decision === "update") {
    const current = getTicketById(match.ticket.id);
    if (!current) throw new Error("Chamado não encontrado.");
    row = updateTicket(current.id, {
      title: payload.title,
      description: `${current.description}\n\nAtualização: ${payload.description}`,
      category: payload.category,
      priority: payload.priority,
      impact: payload.impact,
      type: payload.type,
      status: current.status === "resolved" ? "open" : current.status,
      updatedAt: now.toISOString(),
      dueAt,
      conversationId: record.conversationId,
    });
  } else if (match && decision === "reopen") {
    const current = getTicketById(match.ticket.id);
    if (!current) throw new Error("Chamado não encontrado.");
    row = updateTicket(current.id, {
      description: `${current.description}\n\nReaberto: ${payload.description}`,
      priority: payload.priority,
      impact: payload.impact,
      status: "open",
      resolvedAt: null,
      updatedAt: now.toISOString(),
      dueAt,
      conversationId: record.conversationId,
    });
  } else {
    const code = nextTicketCode(payload.type);
    row = insertTicket({
      id: randomUUID(),
      code,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      subcategory: null,
      priority: payload.priority,
      status: "open",
      requesterId: payload.requesterId,
      assigneeId: null,
      impact: payload.impact,
      openedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      dueAt,
      resolvedAt: null,
      conversationId: record.conversationId,
    });
  }

  const stored = { ...payload, dueAt, resultCode: row.code };
  updateDraft(draftId, { status: "confirmed", payload: JSON.stringify(stored) });
  const view = toDraftView({ ...record, payload: JSON.stringify(stored) }, "confirmed", row.code);
  syncDraftBlocks(draftId, view);
  const ticket = toTicketView(row, now);
  const verb = decision === "create" ? "abri" : decision === "reopen" ? "reabri" : "atualizei";
  insertMessage({
    conversationId: record.conversationId,
    role: "assistant",
    authorName: "Nexo Assist",
    content: `Pronto: ${verb} o chamado ${row.code} com prioridade ${labelPriority(payload.priority)}.`,
    chips: decision === "create" ? ["criou um chamado"] : ["atualizou o chamado"],
    blocks: [{ type: "ticket", ticket }],
    trace: {
      understood: "A pessoa confirmou o rascunho.",
      action: decision === "create" ? "Criar o chamado." : decision === "reopen" ? "Reabrir o chamado resolvido há menos de 7 dias." : "Atualizar o chamado aberto, sem duplicar.",
      confidence: 97,
      reason: "Nada é gravado no sistema de chamados antes da confirmação.",
      tools: ["confirm-draft"],
    },
  });
  return { view, ticket, decision };
}

function labelPriority(priority: Priority): string {
  if (priority === "critical") return "crítica";
  if (priority === "high") return "alta";
  if (priority === "medium") return "média";
  return "baixa";
}

function requirePending(draftId: string, actor: Actor): DraftRecord {
  const record = getDraft(draftId);
  if (!record || record.status !== "pending") throw new Error("Esse rascunho não está mais pendente.");
  if (actor.role === "employee" && actor.id !== record.requesterId) throw new PrivacyError();
  return record;
}

function syncDraftBlocks(draftId: string, view: DraftView): void {
  for (const message of messagesContainingDraft(draftId)) {
    const next = message.blocks.map((block) => (block.type === "draft" && block.draft.draftId === draftId ? { type: "draft" as const, draft: view } : block));
    replaceMessageBlocks(message.id, next);
  }
}

export type { DraftInput, Impact, TicketType };
