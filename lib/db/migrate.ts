import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

const MIGRATIONS: { version: number; file: string }[] = [
  { version: 1, file: "001_init.sql" },
  { version: 2, file: "002_knowledge.sql" },
  { version: 3, file: "003_knowledge_layers.sql" },
];

function tableColumns(db: Database.Database, table: string): Set<string> {
  return new Set(
    (
      db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    ).map((row) => row.name)
  );
}

/** SQLite ADD COLUMN is not idempotent; skip columns that already exist. */
function applyKnowledgeLayers(db: Database.Database): void {
  const cols = tableColumns(db, "knowledge_docs");
  const add: Array<[string, string]> = [
    [
      "layer",
      "ALTER TABLE knowledge_docs ADD COLUMN layer TEXT NOT NULL DEFAULT 'canonical'",
    ],
    [
      "status",
      "ALTER TABLE knowledge_docs ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
    ],
    ["merged_into", "ALTER TABLE knowledge_docs ADD COLUMN merged_into TEXT"],
    ["content_hash", "ALTER TABLE knowledge_docs ADD COLUMN content_hash TEXT"],
  ];
  for (const [name, sql] of add) {
    if (!cols.has(name)) db.exec(sql);
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_docs_layer_status
      ON knowledge_docs (layer, status);
    CREATE INDEX IF NOT EXISTS idx_knowledge_docs_content_hash
      ON knowledge_docs (content_hash);
    CREATE INDEX IF NOT EXISTS idx_knowledge_docs_merged_into
      ON knowledge_docs (merged_into);
  `);
}

export function applyMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    (
      db
        .prepare("SELECT version FROM schema_migrations")
        .all() as { version: number }[]
    ).map((row) => row.version)
  );

  const migrationsDir = path.join(process.cwd(), "lib", "db", "migrations");

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    if (migration.version === 3) {
      applyKnowledgeLayers(db);
      db.prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)"
      ).run(migration.version, new Date().toISOString());
      continue;
    }

    const sqlPath = path.join(migrationsDir, migration.file);
    const sql = fs.readFileSync(sqlPath, "utf8");

    const run = db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)"
      ).run(migration.version, new Date().toISOString());
    });

    run();
  }

  const tables = (
    db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'knowledge_docs'`
      )
      .all() as Array<{ name: string }>
  ).map((r) => r.name);
  if (tables.includes("knowledge_docs")) applyKnowledgeLayers(db);
}
