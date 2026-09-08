import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { applyMigrations } from "@/lib/db/migrate";

declare global {
  // eslint-disable-next-line no-var
  var __jiraAiDb: Database.Database | undefined;
}

function resolveDbPath(): string {
  const dataDir = process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "app.sqlite");
}

export function getDb(): Database.Database {
  if (globalThis.__jiraAiDb) {
    return globalThis.__jiraAiDb;
  }

  const dbPath = resolveDbPath();
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);

  globalThis.__jiraAiDb = db;
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}
