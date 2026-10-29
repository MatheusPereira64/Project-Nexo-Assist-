import { isOverdue } from "./sla";
import {
  CATEGORIES,
  IMPACTS,
  LOW_CONFIDENCE,
  PRIORITIES,
  REOPEN_WINDOW_DAYS,
  TICKET_TYPES,
  type Category,
  type Impact,
  type Priority,
  type Role,
  type TicketType,
} from "./types";

export type Actor = { id: string; role: Role };

export type DraftInput = {
  title: string;
  description: string;
  type: TicketType;
  category: Category;
  priority: Priority;
  impact: Impact;
  requesterId: string;
  existingTicketId?: string | null;
};

export type TicketSnapshot = {
  id: string;
  requesterId: string;
  status: string;
  category: string;
  title: string;
  description: string;
  resolvedAt: string | null;
};

const IT_SIGNAL =
  /(vpn|senha|notebook|e-?mail|outlook|sap|sharepoint|wi-?fi|software|hardware|monitor|windows|rede|impressora|teams|onedrive|chamado|acesso|computador|teclado|mouse)/i;

const OUT_OF_SCOPE =
  /(férias|ferias|holerite|sal[aá]rio|folha de pagamento|benef[ií]cio|facilities|ar[- ]condicionado|limpeza|cafeteria|reembolso|nota fiscal|departamento pessoal|\brh\b)/i;

export function isOutOfScope(text: string): boolean {
  if (IT_SIGNAL.test(text)) return false;
  return OUT_OF_SCOPE.test(text);
}

export function missingDraftFields(draft: Partial<DraftInput>): string[] {
  const missing: string[] = [];
  if (!draft.title?.trim()) missing.push("título");
  if (!draft.description?.trim()) missing.push("descrição");
  if (!draft.type || !TICKET_TYPES.includes(draft.type)) missing.push("tipo");
  if (!draft.category || !CATEGORIES.includes(draft.category)) missing.push("categoria");
  if (!draft.priority || !PRIORITIES.includes(draft.priority)) missing.push("prioridade");
  if (!draft.impact || !IMPACTS.includes(draft.impact)) missing.push("quem é afetado");
  if (!draft.requesterId) missing.push("solicitante");
  return missing;
}

export function classifyPriority(input: {
  impact: Impact;
  stopped: boolean;
  blocksWork: boolean;
  sameDayCommitment: boolean;
  kind: "incident" | "request";
}): Priority {
  if ((input.impact === "team" || input.impact === "company") && input.stopped) return "critical";
  if (input.blocksWork || input.sameDayCommitment) return "high";
  if (input.kind === "request") return "low";
  return "medium";
}

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !STOP.has(token)),
  );
}

const STOP = new Set(["para", "com", "uma", "que", "dos", "das", "por", "nao", "sim", "meu", "minha", "esta", "esse", "essa"]);

export function textOverlap(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

export function duplicateDecision(
  existing: TicketSnapshot,
  draft: { category: string; title: string; description: string; requesterId: string },
  now: Date,
): "update" | "reopen" | "create" {
  if (existing.requesterId !== draft.requesterId) return "create";
  const related =
    existing.category === draft.category &&
    textOverlap(`${existing.title} ${existing.description}`, `${draft.title} ${draft.description}`) >= 0.4;
  if (!related) return "create";
  if (existing.status !== "resolved") return "update";
  if (existing.resolvedAt && daysSince(existing.resolvedAt, now) <= REOPEN_WINDOW_DAYS) return "reopen";
  return "create";
}

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000);
}

export function shouldTransfer(input: {
  userAsked: boolean;
  priority: Priority | null;
  overdue: boolean;
  confidence: number | null;
}): boolean {
  if (input.userAsked) return true;
  if (input.priority === "critical") return true;
  if (input.overdue) return true;
  if (input.confidence !== null && input.confidence < LOW_CONFIDENCE) return true;
  return false;
}

export function userAskedForAnalyst(text: string): boolean {
  return /(falar com|chamar|transfer|analista|atendente|pessoa|humano|algu[eé]m da ti)/i.test(text);
}

export function canReadTickets(actor: Actor, requesterId: string): boolean {
  if (actor.role === "analyst") return true;
  return actor.id === requesterId;
}

export function pickDuplicate(
  tickets: TicketSnapshot[],
  draft: { category: string; title: string; description: string; requesterId: string },
  now: Date,
): { ticket: TicketSnapshot; decision: "update" | "reopen" } | null {
  let best: { ticket: TicketSnapshot; decision: "update" | "reopen"; score: number } | null = null;
  for (const ticket of tickets) {
    const decision = duplicateDecision(ticket, draft, now);
    if (decision === "create") continue;
    const score = textOverlap(`${ticket.title} ${ticket.description}`, `${draft.title} ${draft.description}`);
    if (!best || score > best.score || (decision === "update" && best.decision === "reopen")) {
      best = { ticket, decision, score };
    }
  }
  return best ? { ticket: best.ticket, decision: best.decision } : null;
}

export function ticketIsOverdue(dueAt: string | null, now: Date): boolean {
  if (!dueAt) return false;
  return isOverdue(dueAt, now);
}
