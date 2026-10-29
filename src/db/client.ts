import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { seedDatabase } from "./seed-data";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

let sqlite: Database.Database | null = null;
let orm: AppDatabase | null = null;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL,
  department text NOT NULL,
  initials text NOT NULL,
  support_level text,
  available integer NOT NULL DEFAULT 1,
  password_changed_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  user_id text NOT NULL,
  expires_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations (
  id text PRIMARY KEY,
  employee_id text NOT NULL,
  analyst_id text,
  state text NOT NULL,
  queue text,
  summary text,
  confidence integer,
  transfer_reason text,
  unread_for_analyst integer NOT NULL DEFAULT 0,
  session_started_at text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL,
  role text NOT NULL,
  author_name text NOT NULL,
  content text NOT NULL,
  chips text,
  trace text,
  blocks text,
  created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  subcategory text,
  priority text NOT NULL,
  status text NOT NULL,
  requester_id text NOT NULL,
  assignee_id text,
  impact text NOT NULL,
  opened_at text NOT NULL,
  updated_at text NOT NULL,
  due_at text NOT NULL,
  resolved_at text,
  conversation_id text
);
CREATE TABLE IF NOT EXISTS articles (
  id text PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  keywords text NOT NULL
);
CREATE TABLE IF NOT EXISTS drafts (
  id text PRIMARY KEY,
  code text NOT NULL,
  conversation_id text NOT NULL,
  requester_id text NOT NULL,
  payload text NOT NULL,
  status text NOT NULL,
  created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  email text NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS tickets_requester_idx ON tickets (requester_id);
`;

export function databasePath(): string {
  return process.env.NEXO_DB?.trim() || path.join(process.cwd(), "data", "nexo.sqlite");
}

export function closeDb(): void {
  sqlite?.close();
  sqlite = null;
  orm = null;
}

function ensureOpen(): void {
  if (orm && sqlite) return;
  const filename = databasePath();
  if (filename !== ":memory:") fs.mkdirSync(path.dirname(filename), { recursive: true });
  sqlite = new Database(filename);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.exec(SCHEMA_SQL);
  orm = drizzle(sqlite, { schema });
  const row = sqlite.prepare("select count(*) as c from users").get() as { c: number };
  if (row.c === 0 && process.env.NEXO_AUTO_SEED !== "0") seedDatabase();
}

export function getSqlite(): Database.Database {
  ensureOpen();
  return sqlite as Database.Database;
}

export function getDb(): AppDatabase {
  ensureOpen();
  return orm as AppDatabase;
}

function wipeInPlace(filename: string): void {
  const db = new Database(filename);
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA_SQL);
  const tables = [
    "password_resets",
    "drafts",
    "messages",
    "tickets",
    "articles",
    "conversations",
    "sessions",
    "users",
  ];
  const clear = db.transaction(() => {
    for (const table of tables) db.prepare(`DELETE FROM ${table}`).run();
  });
  clear();
  db.close();
}

export function resetDatabaseFile(): void {
  closeDb();
  const filename = databasePath();
  if (filename !== ":memory:") {
    try {
      for (const suffix of ["", "-wal", "-shm"]) {
        fs.rmSync(filename + suffix, { force: true });
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EBUSY" && code !== "EPERM" && code !== "EACCES") throw error;
      wipeInPlace(filename);
    }
  }
  getDb();
}
