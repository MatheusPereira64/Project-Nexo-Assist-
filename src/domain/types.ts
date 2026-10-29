export const CATEGORIES = [
  "Acesso",
  "Rede e VPN",
  "Hardware",
  "Software",
  "E-mail",
  "Outros",
] as const;

export const PRIORITIES = ["critical", "high", "medium", "low"] as const;
export const TICKET_TYPES = ["INC", "REQ"] as const;
export const TICKET_STATUSES = [
  "open",
  "waiting_analyst",
  "in_progress",
  "approved",
  "resolved",
] as const;
export const IMPACTS = ["only_me", "team", "company", "unknown"] as const;
export const CONVERSATION_STATES = ["with_agent", "waiting", "with_analyst", "closed"] as const;
export const ROLES = ["employee", "analyst"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type TicketType = (typeof TICKET_TYPES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type Impact = (typeof IMPACTS)[number];
export type ConversationState = (typeof CONVERSATION_STATES)[number];
export type Role = (typeof ROLES)[number];

export const SESSION_MESSAGE_LIMIT = 30;
export const LOW_CONFIDENCE = 55;
export const REOPEN_WINDOW_DAYS = 7;

export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Aberto",
  waiting_analyst: "Aguardando analista",
  in_progress: "Em andamento",
  approved: "Aprovado",
  resolved: "Resolvido",
};

export const IMPACT_LABEL: Record<Impact, string> = {
  only_me: "Somente você",
  team: "Minha equipe",
  company: "Toda a empresa",
  unknown: "Não informado",
};

export const STATE_LABEL: Record<ConversationState, string> = {
  with_agent: "Agent atendendo",
  waiting: "Aguardando atendente",
  with_analyst: "Em atendimento",
  closed: "Resolvida pelo agent",
};
