import { getDb, nowIso } from "@/lib/db";

export function getKv<T = unknown>(namespace: string, key: string): T | null {
  const row = getDb()
    .prepare(
      "SELECT value_json FROM kv_store WHERE namespace = ? AND key = ?"
    )
    .get(namespace, key) as { value_json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value_json) as T;
  } catch {
    return null;
  }
}

export function setKv(namespace: string, key: string, value: unknown): void {
  getDb()
    .prepare(
      `INSERT INTO kv_store (namespace, key, value_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(namespace, key) DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at`
    )
    .run(namespace, key, JSON.stringify(value), nowIso());
}

export function deleteKv(namespace: string, key: string): void {
  getDb()
    .prepare("DELETE FROM kv_store WHERE namespace = ? AND key = ?")
    .run(namespace, key);
}
