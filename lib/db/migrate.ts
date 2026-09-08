import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

const MIGRATIONS: { version: number; file: string }[] = [
  { version: 1, file: "001_init.sql" },
];

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
}
