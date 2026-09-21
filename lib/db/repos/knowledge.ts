import { randomUUID } from "node:crypto";
import { getDb, nowIso } from "@/lib/db";

export type KnowledgeSource = "workshop" | "jira" | "manual" | "research";
export type KnowledgeLayer = "raw" | "canonical";
export type KnowledgeStatus = "active" | "merged" | "superseded" | "archived";

export type KnowledgeDoc = {
  id: string;
  title: string;
  source: KnowledgeSource;
  rawText: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  chunkCount?: number;
  layer: KnowledgeLayer;
  status: KnowledgeStatus;
  mergedInto: string | null;
  contentHash: string | null;
};

export type KnowledgeChunkRow = {
  id: string;
  docId: string;
  chunkIndex: number;
  text: string;
  embedding: Buffer;
  embeddingModel: string;
  dims: number;
  tokenEst: number;
};

export type InterviewCoverage = {
  goal: boolean;
  user: boolean;
  acceptance: boolean;
  outOfScope: boolean;
  dependencies: boolean;
  risks: boolean;
};

export type InterviewSessionStatus =
  | "interviewing"
  | "ready"
  | "written"
  | "abandoned";

export type InterviewMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type KnowledgeSession = {
  id: string;
  status: InterviewSessionStatus;
  draftText: string;
  messages: InterviewMessage[];
  coverage: InterviewCoverage;
  output: unknown | null;
  createdAt: string;
  updatedAt: string;
};

export const EMPTY_COVERAGE: InterviewCoverage = {
  goal: false,
  user: false,
  acceptance: false,
  outOfScope: false,
  dependencies: false,
  risks: false,
};

function parseJsonObject(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function isSource(value: unknown): value is KnowledgeSource {
  return (
    value === "workshop" ||
    value === "jira" ||
    value === "manual" ||
    value === "research"
  );
}

function isLayer(value: unknown): value is KnowledgeLayer {
  return value === "raw" || value === "canonical";
}

function isStatus(value: unknown): value is KnowledgeStatus {
  return (
    value === "active" ||
    value === "merged" ||
    value === "superseded" ||
    value === "archived"
  );
}

const DOC_SELECT = `SELECT d.id, d.title, d.source, d.raw_text, d.metadata_json,
              d.created_at, d.updated_at, d.layer, d.status, d.merged_into, d.content_hash,
              (SELECT COUNT(*) FROM knowledge_chunks c WHERE c.doc_id = d.id) AS chunk_count
       FROM knowledge_docs d`;

type DocSqlRow = {
  id: string;
  title: string;
  source: string;
  raw_text: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
  layer: string;
  status: string;
  merged_into: string | null;
  content_hash: string | null;
  chunk_count: number;
};

function rowToDoc(row: DocSqlRow): KnowledgeDoc | null {
  if (!isSource(row.source)) return null;
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    rawText: row.raw_text,
    metadata: parseJsonObject(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    chunkCount: row.chunk_count,
    layer: isLayer(row.layer) ? row.layer : "canonical",
    status: isStatus(row.status) ? row.status : "active",
    mergedInto: row.merged_into,
    contentHash: row.content_hash,
  };
}

export function createKnowledgeDoc(input: {
  title: string;
  source: KnowledgeSource;
  rawText: string;
  metadata?: Record<string, unknown>;
  id?: string;
  layer?: KnowledgeLayer;
  status?: KnowledgeStatus;
  contentHash?: string | null;
  mergedInto?: string | null;
}): KnowledgeDoc {
  const id = input.id || randomUUID();
  const now = nowIso();
  const layer = input.layer ?? "canonical";
  const status = input.status ?? "active";
  const contentHash = input.contentHash ?? null;
  const mergedInto = input.mergedInto ?? null;
  getDb()
    .prepare(
      `INSERT INTO knowledge_docs
       (id, title, source, raw_text, metadata_json, created_at, updated_at,
        layer, status, merged_into, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.title.trim() || "Untitled",
      input.source,
      input.rawText,
      JSON.stringify(input.metadata || {}),
      now,
      now,
      layer,
      status,
      mergedInto,
      contentHash
    );
  return {
    id,
    title: input.title.trim() || "Untitled",
    source: input.source,
    rawText: input.rawText,
    metadata: input.metadata || {},
    createdAt: now,
    updatedAt: now,
    chunkCount: 0,
    layer,
    status,
    mergedInto,
    contentHash,
  };
}

export function getKnowledgeDoc(id: string): KnowledgeDoc | null {
  const row = getDb()
    .prepare(`${DOC_SELECT} WHERE d.id = ?`)
    .get(id) as DocSqlRow | undefined;
  if (!row) return null;
  return rowToDoc(row);
}

export function listKnowledgeDocs(
  limit = 200,
  opts?: { layer?: KnowledgeLayer; status?: KnowledgeStatus }
): KnowledgeDoc[] {
  const clauses: string[] = [];
  const params: Array<string | number> = [];
  if (opts?.layer) {
    clauses.push("d.layer = ?");
    params.push(opts.layer);
  }
  if (opts?.status) {
    clauses.push("d.status = ?");
    params.push(opts.status);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  params.push(limit);
  const rows = getDb()
    .prepare(
      `${DOC_SELECT}${where}
       ORDER BY d.updated_at DESC
       LIMIT ?`
    )
    .all(...params) as DocSqlRow[];

  return rows.map(rowToDoc).filter((d): d is KnowledgeDoc => d != null);
}

export function findDocByContentHash(
  hash: string,
  opts?: { layer?: KnowledgeLayer; status?: KnowledgeStatus }
): KnowledgeDoc | null {
  const clauses = ["d.content_hash = ?"];
  const params: string[] = [hash];
  if (opts?.layer) {
    clauses.push("d.layer = ?");
    params.push(opts.layer);
  }
  if (opts?.status) {
    clauses.push("d.status = ?");
    params.push(opts.status);
  }
  const row = getDb()
    .prepare(`${DOC_SELECT} WHERE ${clauses.join(" AND ")} LIMIT 1`)
    .get(...params) as DocSqlRow | undefined;
  if (!row) return null;
  return rowToDoc(row);
}

export function updateKnowledgeDoc(
  id: string,
  patch: {
    title?: string;
    rawText?: string;
    metadata?: Record<string, unknown>;
    layer?: KnowledgeLayer;
    status?: KnowledgeStatus;
    mergedInto?: string | null;
    contentHash?: string | null;
  }
): KnowledgeDoc | null {
  const current = getKnowledgeDoc(id);
  if (!current) return null;
  const next = {
    title: patch.title ?? current.title,
    rawText: patch.rawText ?? current.rawText,
    metadata: patch.metadata ?? current.metadata,
    layer: patch.layer ?? current.layer,
    status: patch.status ?? current.status,
    mergedInto:
      patch.mergedInto !== undefined ? patch.mergedInto : current.mergedInto,
    contentHash:
      patch.contentHash !== undefined ? patch.contentHash : current.contentHash,
  };
  getDb()
    .prepare(
      `UPDATE knowledge_docs
       SET title = ?, raw_text = ?, metadata_json = ?, layer = ?, status = ?,
           merged_into = ?, content_hash = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      next.title,
      next.rawText,
      JSON.stringify(next.metadata),
      next.layer,
      next.status,
      next.mergedInto,
      next.contentHash,
      nowIso(),
      id
    );
  return getKnowledgeDoc(id);
}

export function markDocsMerged(sourceIds: string[], intoId: string): void {
  if (!sourceIds.length) return;
  const db = getDb();
  const now = nowIso();
  const stmt = db.prepare(
    `UPDATE knowledge_docs
     SET status = 'merged', merged_into = ?, updated_at = ?
     WHERE id = ? AND id != ?`
  );
  const run = db.transaction(() => {
    for (const id of sourceIds) {
      stmt.run(intoId, now, id, intoId);
    }
  });
  run();
}

export function markDocsSuperseded(sourceIds: string[], intoId: string): void {
  if (!sourceIds.length) return;
  const db = getDb();
  const now = nowIso();
  const stmt = db.prepare(
    `UPDATE knowledge_docs
     SET status = 'superseded', merged_into = ?, updated_at = ?
     WHERE id = ? AND id != ?`
  );
  const run = db.transaction(() => {
    for (const id of sourceIds) {
      stmt.run(intoId, now, id, intoId);
    }
  });
  run();
}

export function deleteKnowledgeDoc(id: string): boolean {
  const db = getDb();
  const chunkIds = db
    .prepare(`SELECT id FROM knowledge_chunks WHERE doc_id = ?`)
    .all(id) as Array<{ id: string }>;
  const run = db.transaction(() => {
    for (const c of chunkIds) {
      db.prepare(`DELETE FROM knowledge_chunks_fts WHERE chunk_id = ?`).run(
        c.id
      );
    }
    db.prepare(`DELETE FROM knowledge_chunks WHERE doc_id = ?`).run(id);
    return db.prepare(`DELETE FROM knowledge_docs WHERE id = ?`).run(id);
  });
  return run().changes > 0;
}

export function replaceDocChunks(
  docId: string,
  chunks: Array<{
    text: string;
    embedding: Buffer;
    embeddingModel: string;
    dims: number;
    tokenEst: number;
  }>
): void {
  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM knowledge_chunks WHERE doc_id = ?`)
    .all(docId) as Array<{ id: string }>;

  const run = db.transaction(() => {
    for (const c of existing) {
      db.prepare(`DELETE FROM knowledge_chunks_fts WHERE chunk_id = ?`).run(
        c.id
      );
    }
    db.prepare(`DELETE FROM knowledge_chunks WHERE doc_id = ?`).run(docId);

    const insertChunk = db.prepare(
      `INSERT INTO knowledge_chunks
       (id, doc_id, chunk_index, text, embedding, embedding_model, dims, token_est)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertFts = db.prepare(
      `INSERT INTO knowledge_chunks_fts (text, chunk_id, doc_id) VALUES (?, ?, ?)`
    );

    chunks.forEach((chunk, index) => {
      const id = randomUUID();
      insertChunk.run(
        id,
        docId,
        index,
        chunk.text,
        chunk.embedding,
        chunk.embeddingModel,
        chunk.dims,
        chunk.tokenEst
      );
      insertFts.run(chunk.text, id, docId);
    });

    db.prepare(
      `UPDATE knowledge_docs SET updated_at = ? WHERE id = ?`
    ).run(nowIso(), docId);
  });

  run();
}

export function listChunksForModel(embeddingModel: string): KnowledgeChunkRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, doc_id, chunk_index, text, embedding, embedding_model, dims, token_est
       FROM knowledge_chunks
       WHERE embedding_model = ?`
    )
    .all(embeddingModel) as Array<{
    id: string;
    doc_id: string;
    chunk_index: number;
    text: string;
    embedding: Buffer;
    embedding_model: string;
    dims: number;
    token_est: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    docId: row.doc_id,
    chunkIndex: row.chunk_index,
    text: row.text,
    embedding: row.embedding,
    embeddingModel: row.embedding_model,
    dims: row.dims,
    tokenEst: row.token_est,
  }));
}

/** Chunks from active canonical docs (default RAG pool). */
export function listSearchableChunks(embeddingModel: string): KnowledgeChunkRow[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.doc_id, c.chunk_index, c.text, c.embedding,
              c.embedding_model, c.dims, c.token_est
       FROM knowledge_chunks c
       INNER JOIN knowledge_docs d ON d.id = c.doc_id
       WHERE c.embedding_model = ?
         AND d.status = 'active'
         AND d.layer = 'canonical'`
    )
    .all(embeddingModel) as Array<{
    id: string;
    doc_id: string;
    chunk_index: number;
    text: string;
    embedding: Buffer;
    embedding_model: string;
    dims: number;
    token_est: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    docId: row.doc_id,
    chunkIndex: row.chunk_index,
    text: row.text,
    embedding: row.embedding,
    embeddingModel: row.embedding_model,
    dims: row.dims,
    tokenEst: row.token_est,
  }));
}

export function listSearchableChunksAll(): KnowledgeChunkRow[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.doc_id, c.chunk_index, c.text, c.embedding,
              c.embedding_model, c.dims, c.token_est
       FROM knowledge_chunks c
       INNER JOIN knowledge_docs d ON d.id = c.doc_id
       WHERE d.status = 'active'
         AND d.layer = 'canonical'`
    )
    .all() as Array<{
    id: string;
    doc_id: string;
    chunk_index: number;
    text: string;
    embedding: Buffer;
    embedding_model: string;
    dims: number;
    token_est: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    docId: row.doc_id,
    chunkIndex: row.chunk_index,
    text: row.text,
    embedding: row.embedding,
    embeddingModel: row.embedding_model,
    dims: row.dims,
    tokenEst: row.token_est,
  }));
}

export function listAllChunks(): KnowledgeChunkRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, doc_id, chunk_index, text, embedding, embedding_model, dims, token_est
       FROM knowledge_chunks`
    )
    .all() as Array<{
    id: string;
    doc_id: string;
    chunk_index: number;
    text: string;
    embedding: Buffer;
    embedding_model: string;
    dims: number;
    token_est: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    docId: row.doc_id,
    chunkIndex: row.chunk_index,
    text: row.text,
    embedding: row.embedding,
    embeddingModel: row.embedding_model,
    dims: row.dims,
    tokenEst: row.token_est,
  }));
}

export function ftsSearchChunkIds(query: string, limit = 40): string[] {
  const q = query.trim();
  if (!q) return [];
  // Escape FTS5 special chars lightly by quoting tokens
  const tokens = q
    .split(/\s+/)
    .map((t) => t.replace(/["']/g, "").trim())
    .filter(Boolean)
    .slice(0, 12);
  if (!tokens.length) return [];
  const match = tokens.map((t) => `"${t}"*`).join(" OR ");
  try {
    const rows = getDb()
      .prepare(
        `SELECT chunk_id FROM knowledge_chunks_fts
         WHERE knowledge_chunks_fts MATCH ?
         LIMIT ?`
      )
      .all(match, limit) as Array<{ chunk_id: string }>;
    return rows.map((r) => r.chunk_id);
  } catch {
    return [];
  }
}

export function getDocTitlesByIds(
  ids: string[]
): Map<string, { title: string; source: KnowledgeSource }> {
  const map = new Map<string, { title: string; source: KnowledgeSource }>();
  if (!ids.length) return map;
  const placeholders = ids.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT id, title, source FROM knowledge_docs WHERE id IN (${placeholders})`
    )
    .all(...ids) as Array<{ id: string; title: string; source: string }>;
  for (const row of rows) {
    if (!isSource(row.source)) continue;
    map.set(row.id, { title: row.title, source: row.source });
  }
  return map;
}

export function knowledgeStats(): {
  docs: number;
  chunks: number;
  models: string[];
  canonical: number;
  raw: number;
  merged: number;
} {
  const db = getDb();
  const count = (sql: string) =>
    (db.prepare(sql).get() as { n: number }).n;
  const docs = count(`SELECT COUNT(*) AS n FROM knowledge_docs`);
  const chunks = count(`SELECT COUNT(*) AS n FROM knowledge_chunks`);
  const canonical = count(
    `SELECT COUNT(*) AS n FROM knowledge_docs WHERE layer = 'canonical' AND status = 'active'`
  );
  const raw = count(
    `SELECT COUNT(*) AS n FROM knowledge_docs WHERE layer = 'raw'`
  );
  const merged = count(
    `SELECT COUNT(*) AS n FROM knowledge_docs WHERE status IN ('merged', 'superseded')`
  );
  const models = (
    db
      .prepare(
        `SELECT DISTINCT embedding_model AS m FROM knowledge_chunks ORDER BY m`
      )
      .all() as Array<{ m: string }>
  ).map((r) => r.m);
  return { docs, chunks, models, canonical, raw, merged };
}

function parseCoverage(raw: string): InterviewCoverage {
  const obj = parseJsonObject(raw);
  return {
    goal: !!obj.goal,
    user: !!obj.user,
    acceptance: !!obj.acceptance,
    outOfScope: !!obj.outOfScope,
    dependencies: !!obj.dependencies,
    risks: !!obj.risks,
  };
}

function parseMessages(raw: string): InterviewMessage[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant" || m.role === "system") &&
          typeof m.content === "string"
      )
      .map((m) => ({ role: m.role, content: m.content }));
  } catch {
    return [];
  }
}

export function createInterviewSession(draftText = ""): KnowledgeSession {
  const id = randomUUID();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO knowledge_sessions
       (id, status, draft_text, messages_json, coverage_json, output_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
    )
    .run(
      id,
      "interviewing",
      draftText,
      "[]",
      JSON.stringify(EMPTY_COVERAGE),
      now,
      now
    );
  return {
    id,
    status: "interviewing",
    draftText,
    messages: [],
    coverage: { ...EMPTY_COVERAGE },
    output: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getInterviewSession(id: string): KnowledgeSession | null {
  const row = getDb()
    .prepare(
      `SELECT id, status, draft_text, messages_json, coverage_json, output_json, created_at, updated_at
       FROM knowledge_sessions WHERE id = ?`
    )
    .get(id) as
    | {
        id: string;
        status: string;
        draft_text: string;
        messages_json: string;
        coverage_json: string;
        output_json: string | null;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row) return null;
  let output: unknown = null;
  if (row.output_json) {
    try {
      output = JSON.parse(row.output_json);
    } catch {
      output = null;
    }
  }
  return {
    id: row.id,
    status: row.status as InterviewSessionStatus,
    draftText: row.draft_text,
    messages: parseMessages(row.messages_json),
    coverage: parseCoverage(row.coverage_json),
    output,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getLatestOpenInterviewSession(): KnowledgeSession | null {
  const row = getDb()
    .prepare(
      `SELECT id FROM knowledge_sessions
       WHERE status IN ('interviewing', 'ready')
       ORDER BY updated_at DESC LIMIT 1`
    )
    .get() as { id: string } | undefined;
  if (!row) return null;
  return getInterviewSession(row.id);
}

export function updateInterviewSession(
  id: string,
  patch: {
    status?: InterviewSessionStatus;
    draftText?: string;
    messages?: InterviewMessage[];
    coverage?: InterviewCoverage;
    output?: unknown | null;
  }
): KnowledgeSession | null {
  const current = getInterviewSession(id);
  if (!current) return null;
  const next = {
    status: patch.status ?? current.status,
    draftText: patch.draftText ?? current.draftText,
    messages: patch.messages ?? current.messages,
    coverage: patch.coverage ?? current.coverage,
    output: patch.output !== undefined ? patch.output : current.output,
  };
  getDb()
    .prepare(
      `UPDATE knowledge_sessions
       SET status = ?, draft_text = ?, messages_json = ?, coverage_json = ?,
           output_json = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      next.status,
      next.draftText,
      JSON.stringify(next.messages),
      JSON.stringify(next.coverage),
      next.output == null ? null : JSON.stringify(next.output),
      nowIso(),
      id
    );
  return getInterviewSession(id);
}
