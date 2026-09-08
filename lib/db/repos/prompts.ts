import { getDb, nowIso } from "@/lib/db";

export type CustomPrompt = {
  id: string;
  name: string;
  prompt: string;
  description: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: {
  id: string;
  name: string;
  prompt: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}): CustomPrompt {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listCustomPrompts(): CustomPrompt[] {
  const rows = getDb()
    .prepare(
      `SELECT id, name, prompt, description, sort_order, created_at, updated_at
       FROM custom_prompts
       ORDER BY sort_order ASC, created_at ASC`
    )
    .all() as Array<{
    id: string;
    name: string;
    prompt: string;
    description: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map(mapRow);
}

export function createCustomPrompt(input: {
  id?: string;
  name: string;
  prompt: string;
  description?: string;
  sortOrder?: number;
}): CustomPrompt {
  const id = input.id || crypto.randomUUID();
  const now = nowIso();
  const sortOrder = input.sortOrder ?? Date.now();
  getDb()
    .prepare(
      `INSERT INTO custom_prompts
       (id, name, prompt, description, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.name,
      input.prompt,
      input.description || "",
      sortOrder,
      now,
      now
    );
  return {
    id,
    name: input.name,
    prompt: input.prompt,
    description: input.description || "",
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

export function deleteCustomPrompt(id: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM custom_prompts WHERE id = ?")
    .run(id);
  return result.changes > 0;
}

export function replaceAllCustomPrompts(
  prompts: Array<{
    id: string;
    name: string;
    prompt: string;
    description?: string;
  }>
): CustomPrompt[] {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM custom_prompts").run();
    const insert = db.prepare(
      `INSERT INTO custom_prompts
       (id, name, prompt, description, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const now = nowIso();
    prompts.forEach((p, index) => {
      insert.run(
        p.id,
        p.name,
        p.prompt,
        p.description || "",
        index,
        now,
        now
      );
    });
  });
  tx();
  return listCustomPrompts();
}
