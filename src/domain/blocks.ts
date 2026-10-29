import type { ConversationState, Impact, Priority, Role, TicketStatus, TicketType } from "./types";

export type Trace = {
  understood: string;
  action: string;
  confidence: number;
  reason: string;
  tools: string[];
};

export type TicketView = {
  id: string;
  code: string;
  type: TicketType;
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  priority: Priority;
  status: TicketStatus;
  impact: Impact;
  openedAt: string;
  updatedAt: string;
  dueAt: string;
  resolvedAt: string | null;
  overdue: boolean;
  requesterId: string;
  requesterName?: string;
  conversationId?: string | null;
};

export type ChoiceOption = { id: string; label: string };

export type DraftView = {
  draftId: string;
  code: string;
  status: "pending" | "confirmed" | "cancelled";
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  priority: Priority;
  ticketType: TicketType;
  impact: Impact;
  dueAt: string;
  affectedLabel: string;
  resultCode?: string;
};

export type Block =
  | { type: "tickets"; tickets: TicketView[] }
  | { type: "ticket"; ticket: TicketView }
  | { type: "choices"; options: ChoiceOption[] }
  | { type: "draft"; draft: DraftView }
  | { type: "actions"; actions: ChoiceOption[] };

export type MessageView = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "analyst" | "system";
  authorName: string;
  content: string;
  createdAt: string;
  chips: string[];
  trace: Trace | null;
  blocks: Block[];
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  initials: string;
  supportLevel: string | null;
  available: boolean;
  passwordChangedAt: string;
};

export type ConversationView = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeInitials: string;
  employeeDepartment: string;
  analystId: string | null;
  analystName: string | null;
  state: ConversationState;
  queue: string | null;
  summary: string | null;
  confidence: number | null;
  transferReason: string | null;
  unreadForAnalyst: number;
  sessionStartedAt: string;
  updatedAt: string;
  preview: string;
  previewAt: string | null;
};

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
