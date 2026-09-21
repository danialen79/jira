CREATE TABLE IF NOT EXISTS knowledge_docs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_source
  ON knowledge_docs (source);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_updated_at
  ON knowledge_docs (updated_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding BLOB NOT NULL,
  embedding_model TEXT NOT NULL,
  dims INTEGER NOT NULL,
  token_est INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc_id
  ON knowledge_chunks (doc_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_model
  ON knowledge_chunks (embedding_model);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
  text,
  chunk_id UNINDEXED,
  doc_id UNINDEXED
);

CREATE TABLE IF NOT EXISTS knowledge_sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  draft_text TEXT NOT NULL DEFAULT '',
  messages_json TEXT NOT NULL DEFAULT '[]',
  coverage_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sessions_status
  ON knowledge_sessions (status);
CREATE INDEX IF NOT EXISTS idx_knowledge_sessions_updated_at
  ON knowledge_sessions (updated_at DESC);
