import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  initials: text("initials").notNull(),
  supportLevel: text("support_level"),
  available: integer("available").notNull().default(1),
  passwordChangedAt: text("password_changed_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  analystId: text("analyst_id"),
  state: text("state").notNull(),
  queue: text("queue"),
  summary: text("summary"),
  confidence: integer("confidence"),
  transferReason: text("transfer_reason"),
  unreadForAnalyst: integer("unread_for_analyst").notNull().default(0),
  sessionStartedAt: text("session_started_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  role: text("role").notNull(),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  chips: text("chips"),
  trace: text("trace"),
  blocks: text("blocks"),
  createdAt: text("created_at").notNull(),
});

export const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  requesterId: text("requester_id").notNull(),
  assigneeId: text("assignee_id"),
  impact: text("impact").notNull(),
  openedAt: text("opened_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  dueAt: text("due_at").notNull(),
  resolvedAt: text("resolved_at"),
  conversationId: text("conversation_id"),
});

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  keywords: text("keywords").notNull(),
});

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  conversationId: text("conversation_id").notNull(),
  requesterId: text("requester_id").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const passwordResets = sqliteTable("password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull(),
});
