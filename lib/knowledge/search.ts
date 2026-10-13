import { getDb, nowIso } from "@/lib/db";
import {
  bufferToFloat32,
  cosineSimilarity,
  embedText,
  embedTexts,
  embeddingToBlob,
  resolveEmbeddingModel,
} from "@/lib/embeddings";
import {
  createKnowledgeDoc,
  findDocByContentHash,
  ftsSearchChunks,
  getDocTitlesByIds,
  getKnowledgeDoc,
  knowledgeStats,
  listKnowledgeDocs,
  listSearchableChunks,
  replaceDocChunks,
  type KnowledgeDoc,
  type KnowledgeLayer,
  type KnowledgeSource,
} from "@/lib/db/repos/knowledge";
import {
  buildEmbedText,
  chunkText,
  estimateTokens,
  type TextChunk,
} from "@/lib/knowledge/chunk";
import { hashKnowledgeText } from "@/lib/knowledge/hash";
import { normalizePersian } from "@/lib/knowledge/normalize";
import { reciprocalRankFusion } from "@/lib/knowledge/rrf";
import { rerankByRelevance } from "@/lib/knowledge/rerank";

export type KnowledgeHit = {
  chunkId: string;
  docId: string;
  title: string;
  source: KnowledgeSource;
  text: string;
  score: number;
};

export type KnowledgeSearchOutcome = {
  hits: KnowledgeHit[];
  stale: boolean;
};

const NEAR_DUP_THRESHOLD = 0.92;
const DENSE_K = 50;
const SPARSE_K = 50;
const COSINE_FLOOR = 0.32;
const BM25_KEEP_RANK = 8;
const RERANK_POOL = 20;

export async function ingestDocument(input: {
  title: string;
  source: KnowledgeSource;
  rawText: string;
  metadata?: Record<string, unknown>;
  provider?: string;
  docId?: string;
  layer?: KnowledgeLayer;
  embed?: boolean;
}): Promise<{
  doc: KnowledgeDoc;
  chunkCount: number;
  model: string;
  skipped?: "hash" | "near-dup";
}> {
  const text = input.rawText.trim();
  if (!text) throw new Error("Document text is empty");

  const layer = input.layer ?? "canonical";
  const shouldEmbed = input.embed ?? layer !== "raw";
  const contentHash = hashKnowledgeText(text);

  if (!input.docId && layer === "canonical") {
    const existing = findDocByContentHash(contentHash, {
      layer: "canonical",
      status: "active",
    });
    if (existing) {
      return {
        doc: existing,
        chunkCount: existing.chunkCount ?? 0,
        model: resolveEmbeddingModel(input.provider).model,
        skipped: "hash",
      };
    }
  }

  const { provider, model } = resolveEmbeddingModel(input.provider);

  let pieces: TextChunk[] = [];
  let vectors: number[][] = [];
  if (shouldEmbed) {
    pieces = chunkText(text);
    if (!pieces.length) throw new Error("No chunks produced");

    const embedInputs = pieces.map((piece) =>
      buildEmbedText(input.title, piece, normalizePersian(piece.text))
    );

    const batchSize = 8;
    for (let i = 0; i < embedInputs.length; i += batchSize) {
      const batch = embedInputs.slice(i, i + batchSize);
      const result = await embedTexts(batch, provider, "document");
      vectors.push(...result.vectors);
    }

    if (!input.docId && layer === "canonical" && vectors[0]) {
      const dup = findNearDuplicateFromVector(vectors[0], model);
      if (dup) {
        return {
          doc: dup,
          chunkCount: dup.chunkCount ?? 0,
          model,
          skipped: "near-dup",
        };
      }
    }
  }

  let doc: KnowledgeDoc;
  if (input.docId) {
    const existing = getKnowledgeDoc(input.docId);
    if (!existing) throw new Error("Document not found");
    getDb()
      .prepare(
        `UPDATE knowledge_docs
         SET title = ?, raw_text = ?, metadata_json = ?, content_hash = ?,
             layer = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.title.trim() || existing.title,
        text,
        JSON.stringify(input.metadata ?? existing.metadata),
        contentHash,
        layer,
        nowIso(),
        input.docId
      );
    doc = getKnowledgeDoc(input.docId)!;
  } else {
    doc = createKnowledgeDoc({
      title: input.title,
      source: input.source,
      rawText: text,
      metadata: input.metadata,
      layer,
      contentHash,
    });
  }

  if (shouldEmbed) {
    replaceDocChunks(
      doc.id,
      pieces.map((piece, i) => ({
        text: piece.text,
        ftsText: normalizePersian(
          [piece.heading, piece.text].filter(Boolean).join("\n")
        ),
        embedding: embeddingToBlob(vectors[i]!),
        embeddingModel: model,
        dims: vectors[i]!.length,
        tokenEst: estimateTokens(piece.text),
      }))
    );
  }

  const refreshed = getKnowledgeDoc(doc.id)!;
  return { doc: refreshed, chunkCount: pieces.length, model };
}

function findNearDuplicateFromVector(
  vector: number[],
  model: string
): KnowledgeDoc | null {
  const pool = listSearchableChunks(model);
  let best: { docId: string; score: number } | null = null;
  for (const chunk of pool) {
    const vec = bufferToFloat32(chunk.embedding);
    if (vec.length !== vector.length) continue;
    const score = cosineSimilarity(vector, vec);
    if (!best || score > best.score) best = { docId: chunk.docId, score };
  }
  if (!best || best.score < NEAR_DUP_THRESHOLD) return null;
  return getKnowledgeDoc(best.docId);
}

export async function reembedAllDocuments(provider?: string): Promise<{
  docs: number;
  chunks: number;
  model: string;
}> {
  const { provider: id, model } = resolveEmbeddingModel(provider);
  const docs = listKnowledgeDocs(1000, {
    layer: "canonical",
    status: "active",
  });
  let chunks = 0;
  for (const doc of docs) {
    const result = await ingestDocument({
      title: doc.title,
      source: doc.source,
      rawText: doc.rawText,
      metadata: doc.metadata,
      provider: id,
      docId: doc.id,
      layer: "canonical",
      embed: true,
    });
    chunks += result.chunkCount;
  }
  return { docs: docs.length, chunks, model };
}

function queryList(query: string | string[]): string[] {
  const raw = Array.isArray(query) ? query : [query];
  const out: string[] = [];
  for (const item of raw) {
    const text = item.trim();
    if (!text || out.includes(text)) continue;
    out.push(text);
  }
  return out;
}

export async function searchKnowledge(
  query: string | string[],
  opts?: { k?: number; provider?: string }
): Promise<KnowledgeSearchOutcome> {
  const queries = queryList(query);
  if (!queries.length) return { hits: [], stale: false };

  const k = opts?.k ?? 8;
  const { model } = resolveEmbeddingModel(opts?.provider);
  const pool = listSearchableChunks(model);
  if (!pool.length) {
    const stats = knowledgeStats();
    const stale = stats.chunks > 0 && !stats.models.includes(model);
    return { hits: [], stale };
  }

  const decoded = pool.map((chunk) => ({
    chunk,
    vector: bufferToFloat32(chunk.embedding),
  }));

  const cosineById = new Map<string, number>();
  const bm25ById = new Map<string, number>();
  const denseLists: string[][] = [];
  const sparseLists: string[][] = [];

  for (const rawQuery of queries) {
    const normalized = normalizePersian(rawQuery);
    if (!normalized) continue;

    const queryEmb = await embedText(normalized, opts?.provider, "query");
    const dense = decoded
      .map((row) => {
        const cos =
          row.vector.length === queryEmb.vector.length
            ? cosineSimilarity(row.vector, queryEmb.vector)
            : 0;
        const prev = cosineById.get(row.chunk.id) ?? 0;
        if (cos > prev) cosineById.set(row.chunk.id, cos);
        return { id: row.chunk.id, cos };
      })
      .sort((a, b) => b.cos - a.cos)
      .slice(0, DENSE_K)
      .map((row) => row.id);
    if (dense.length) denseLists.push(dense);

    const fts = ftsSearchChunks(normalized, SPARSE_K);
    if (fts.length) sparseLists.push(fts.map((hit) => hit.chunkId));
    for (const hit of fts) {
      const prev = bm25ById.get(hit.chunkId);
      if (prev == null || hit.rank < prev) bm25ById.set(hit.chunkId, hit.rank);
    }
  }

  const fused = reciprocalRankFusion([...denseLists, ...sparseLists]);
  const byId = new Map(decoded.map((row) => [row.chunk.id, row.chunk]));
  const gated = fused
    .filter((item) => {
      const cos = cosineById.get(item.id) ?? 0;
      const rank = bm25ById.get(item.id);
      return cos >= COSINE_FLOOR || (rank != null && rank <= BM25_KEEP_RANK);
    })
    .slice(0, RERANK_POOL);

  const docMeta = getDocTitlesByIds(gated.map((item) => byId.get(item.id)?.docId || ""));
  const candidates: KnowledgeHit[] = gated.flatMap((item) => {
    const chunk = byId.get(item.id);
    if (!chunk) return [];
    const meta = docMeta.get(chunk.docId);
    return [
      {
        chunkId: chunk.id,
        docId: chunk.docId,
        title: meta?.title || "Untitled",
        source: meta?.source || "manual",
        text: chunk.text,
        score: item.score,
      },
    ];
  });

  const hits = await rerankByRelevance(
    queries.join(" | "),
    candidates,
    k,
    opts?.provider
  );
  return { hits, stale: false };
}

export function formatHitsForPrompt(hits: KnowledgeHit[]): string {
  if (!hits.length) return "(no knowledge hits)";
  return hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.title} (${h.source}, score=${h.score.toFixed(3)})\n${h.text}`
    )
    .join("\n\n");
}

export const STALE_KNOWLEDGE_PROMPT =
  "(knowledge index is stale — re-embed documents in Knowledge before trusting memory)";
