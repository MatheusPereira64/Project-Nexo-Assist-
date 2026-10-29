import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ticketIsOverdue } from "@/domain/policy";
import type { Block, ConversationView, MessageView, PublicUser, TicketView, Trace } from "@/domain/blocks";
import { parseJson } from "@/domain/blocks";
import type { Impact, Priority, TicketStatus, TicketType } from "@/domain/types";
import { getDb, getSqlite } from "./client";
import { articles, conversations, drafts, messages, passwordResets, sessions, tickets, users } from "./schema";

export type UserRecord = typeof users.$inferSelect;
export type TicketRecord = typeof tickets.$inferSelect;
export type DraftRecord = typeof drafts.$inferSelect;
export type ConversationRecord = typeof conversations.$inferSelect;

function toPublicUser(row: UserRecord): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as PublicUser["role"],
    department: row.department,
    initials: row.initials,
    supportLevel: row.supportLevel,
    available: row.available === 1,
    passwordChangedAt: row.passwordChangedAt,
  };
}

export function toTicketView(row: TicketRecord, now = new Date(), requesterName?: string): TicketView {
  return {
    id: row.id,
    code: row.code,
    type: row.type as TicketType,
    title: row.title,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    priority: row.priority as Priority,
    status: row.status as TicketStatus,
    impact: row.impact as Impact,
    openedAt: row.openedAt,
    updatedAt: row.updatedAt,
    dueAt: row.dueAt,
    resolvedAt: row.resolvedAt,
    overdue: row.status !== "resolved" && ticketIsOverdue(row.dueAt, now),
    requesterId: row.requesterId,
    requesterName,
    conversationId: row.conversationId,
  };
}

function toMessage(row: typeof messages.$inferSelect): MessageView {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as MessageView["role"],
    authorName: row.authorName,
    content: row.content,
    createdAt: row.createdAt,
    chips: parseJson<string[]>(row.chips, []),
    trace: parseJson<Trace | null>(row.trace, null),
    blocks: parseJson<Block[]>(row.blocks, []),
  };
}

export function getUserByEmail(email: string): UserRecord | undefined {
  return getDb().select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
}

export function getUserById(id: string): UserRecord | undefined {
  return getDb().select().from(users).where(eq(users.id, id)).get();
}

export function listUsers(): UserRecord[] {
  return getDb().select().from(users).all();
}

export function setAvailability(userId: string, available: boolean): void {
  getDb().update(users).set({ available: available ? 1 : 0 }).where(eq(users.id, userId)).run();
}

export function createSession(userId: string, expiresAt: Date): string {
  const token = randomUUID();
  getDb().insert(sessions).values({ token, userId, expiresAt: expiresAt.toISOString() }).run();
  return token;
}

export function deleteSession(token: string): void {
  getDb().delete(sessions).where(eq(sessions.token, token)).run();
}

export function getUserBySession(token: string): PublicUser | null {
  const session = getDb().select().from(sessions).where(eq(sessions.token, token)).get();
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    deleteSession(token);
    return null;
  }
  const user = getUserById(session.userId);
  return user ? toPublicUser(user) : null;
}

export function insertPasswordReset(userId: string, email: string): void {
  getDb()
    .insert(passwordResets)
    .values({ id: randomUUID(), userId, email, createdAt: new Date().toISOString() })
    .run();
}

export function listMessages(conversationId: string): MessageView[] {
  return getDb()
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .all()
    .map(toMessage);
}

export function countSessionMessages(conversationId: string, since: string): number {
  const row = getSqlite()
    .prepare(
      `select count(*) as c from messages
       where conversation_id = ? and created_at >= ? and role in ('user', 'assistant')`,
    )
    .get(conversationId, since) as { c: number };
  return row.c;
}

export type NewMessage = {
  conversationId: string;
  role: MessageView["role"];
  authorName: string;
  content: string;
  chips?: string[];
  trace?: Trace | null;
  blocks?: Block[];
  createdAt?: string;
};

export function insertMessage(input: NewMessage): MessageView {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const row = {
    id: randomUUID(),
    conversationId: input.conversationId,
    role: input.role,
    authorName: input.authorName,
    content: input.content,
    chips: input.chips?.length ? JSON.stringify(input.chips) : null,
    trace: input.trace ? JSON.stringify(input.trace) : null,
    blocks: input.blocks?.length ? JSON.stringify(input.blocks) : null,
    createdAt,
  };
  getDb().insert(messages).values(row).run();
  getDb().update(conversations).set({ updatedAt: createdAt }).where(eq(conversations.id, input.conversationId)).run();
  return toMessage(row);
}

export function replaceMessageBlocks(messageId: string, blocks: Block[]): void {
  getDb()
    .update(messages)
    .set({ blocks: JSON.stringify(blocks) })
    .where(eq(messages.id, messageId))
    .run();
}

export function listConversations(): ConversationView[] {
  const rows = getSqlite()
    .prepare(
      `select c.*,
        e.name as employee_name, e.email as employee_email, e.initials as employee_initials, e.department as employee_department,
        a.name as analyst_name,
        (select content from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as preview,
        (select created_at from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as preview_at
       from conversations c
       join users e on e.id = c.employee_id
       left join users a on a.id = c.analyst_id
       order by c.updated_at desc`,
    )
    .all() as Array<Record<string, string | number | null>>;

  const rank: Record<string, number> = { waiting: 0, with_analyst: 1, with_agent: 2, closed: 3 };
  return rows.map((row) => ({
    id: String(row.id),
    employeeId: String(row.employee_id),
    employeeName: String(row.employee_name),
    employeeEmail: String(row.employee_email),
    employeeInitials: String(row.employee_initials),
    employeeDepartment: String(row.employee_department),
    analystId: row.analyst_id ? String(row.analyst_id) : null,
    analystName: row.analyst_name ? String(row.analyst_name) : null,
    state: String(row.state) as ConversationView["state"],
    queue: row.queue ? String(row.queue) : null,
    summary: row.summary ? String(row.summary) : null,
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    transferReason: row.transfer_reason ? String(row.transfer_reason) : null,
    unreadForAnalyst: Number(row.unread_for_analyst ?? 0),
    sessionStartedAt: String(row.session_started_at),
    updatedAt: String(row.updated_at),
    preview: row.preview ? String(row.preview) : "",
    previewAt: row.preview_at ? String(row.preview_at) : null,
  })).sort((a, b) => (rank[a.state] ?? 9) - (rank[b.state] ?? 9) || b.updatedAt.localeCompare(a.updatedAt));
}

export function getConversation(id: string): ConversationView | undefined {
  return listConversations().find((item) => item.id === id);
}

export function getConversationRecord(id: string): ConversationRecord | undefined {
  return getDb().select().from(conversations).where(eq(conversations.id, id)).get();
}

export function insertConversation(input: {
  employeeId: string;
  state?: ConversationView["state"];
  createdAt?: string;
}): ConversationRecord {
  const now = input.createdAt ?? new Date().toISOString();
  const row = {
    id: randomUUID(),
    employeeId: input.employeeId,
    analystId: null,
    state: input.state ?? "with_agent",
    queue: null,
    summary: null,
    confidence: null,
    transferReason: null,
    unreadForAnalyst: 0,
    sessionStartedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(conversations).values(row).run();
  return row;
}

export function updateConversation(id: string, patch: Partial<typeof conversations.$inferInsert>): void {
  getDb().update(conversations).set(patch).where(eq(conversations.id, id)).run();
}

export function latestOpenConversation(employeeId: string): ConversationRecord | undefined {
  return getDb()
    .select()
    .from(conversations)
    .where(and(eq(conversations.employeeId, employeeId), sql`${conversations.state} != 'closed'`))
    .orderBy(desc(conversations.updatedAt))
    .get();
}

export function listTicketsByRequester(requesterId: string, now = new Date()): TicketView[] {
  const rows = getDb().select().from(tickets).where(eq(tickets.requesterId, requesterId)).all();
  return rows
    .map((row) => toTicketView(row, now))
    .sort((a, b) => {
      const rank = (status: string) => (status === "resolved" ? 1 : 0);
      return rank(a.status) - rank(b.status) || b.updatedAt.localeCompare(a.updatedAt);
    });
}

export function getTicketByCode(code: string): TicketRecord | undefined {
  return getDb().select().from(tickets).where(eq(tickets.code, code.toUpperCase())).get();
}

export function getTicketById(id: string): TicketRecord | undefined {
  return getDb().select().from(tickets).where(eq(tickets.id, id)).get();
}

export function findTicket(idOrCode: string): TicketRecord | undefined {
  return getTicketById(idOrCode) ?? getTicketByCode(idOrCode);
}

export function nextTicketCode(type: "INC" | "REQ"): string {
  const row = getDb()
    .select({ code: tickets.code })
    .from(tickets)
    .where(like(tickets.code, `${type}-%`))
    .all()
    .map((item) => Number(item.code.slice(type.length + 1)))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];
  const next = (row ?? (type === "INC" ? 20520 : 10450)) + 1;
  return `${type}-${next}`;
}

export function insertTicket(input: typeof tickets.$inferInsert): TicketRecord {
  getDb().insert(tickets).values(input).run();
  return input as TicketRecord;
}

export function updateTicket(id: string, patch: Partial<typeof tickets.$inferInsert>): TicketRecord {
  getDb().update(tickets).set(patch).where(eq(tickets.id, id)).run();
  const row = getTicketById(id);
  if (!row) throw new Error("Chamado não encontrado.");
  return row;
}

export function listArticles(): Array<typeof articles.$inferSelect> {
  return getDb().select().from(articles).all();
}

export function insertDraft(input: {
  conversationId: string;
  requesterId: string;
  payload: unknown;
}): DraftRecord {
  const count = getSqlite().prepare("select count(*) as c from drafts").get() as { c: number };
  const row: DraftRecord = {
    id: randomUUID(),
    code: `D-${String(380 + count.c + 1)}`,
    conversationId: input.conversationId,
    requesterId: input.requesterId,
    payload: JSON.stringify(input.payload),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  getDb().insert(drafts).values(row).run();
  return row;
}

export function getDraft(id: string): DraftRecord | undefined {
  return getDb().select().from(drafts).where(eq(drafts.id, id)).get();
}

export function updateDraft(id: string, patch: Partial<typeof drafts.$inferInsert>): void {
  getDb().update(drafts).set(patch).where(eq(drafts.id, id)).run();
}

export function messagesContainingDraft(draftId: string): MessageView[] {
  return getSqlite()
    .prepare(`select * from messages where blocks like ?`)
    .all(`%${draftId}%`)
    .map((row) =>
      toMessage({
        id: String((row as { id: string }).id),
        conversationId: String((row as { conversation_id: string }).conversation_id),
        role: String((row as { role: string }).role),
        authorName: String((row as { author_name: string }).author_name),
        content: String((row as { content: string }).content),
        chips: (row as { chips: string | null }).chips,
        trace: (row as { trace: string | null }).trace,
        blocks: (row as { blocks: string | null }).blocks,
        createdAt: String((row as { created_at: string }).created_at),
      }),
    );
}
