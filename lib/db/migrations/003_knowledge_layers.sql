ALTER TABLE knowledge_docs ADD COLUMN layer TEXT NOT NULL DEFAULT 'canonical';
ALTER TABLE knowledge_docs ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE knowledge_docs ADD COLUMN merged_into TEXT;
ALTER TABLE knowledge_docs ADD COLUMN content_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_layer_status
  ON knowledge_docs (layer, status);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_content_hash
  ON knowledge_docs (content_hash);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_merged_into
  ON knowledge_docs (merged_into);
