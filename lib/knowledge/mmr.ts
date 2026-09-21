import { cosineSimilarity } from "@/lib/embeddings";

export type MmrCandidate<T> = {
  item: T;
  score: number;
  vector: number[];
};

/** Maximal Marginal Relevance: rank by relevance minus similarity to already picked items. */
export function mmrRerank<T>(
  candidates: MmrCandidate<T>[],
  k: number,
  lambda = 0.7
): T[] {
  if (!candidates.length || k <= 0) return [];
  const pool = [...candidates];
  pool.sort((a, b) => b.score - a.score);

  const selected: MmrCandidate<T>[] = [pool.shift()!];
  while (selected.length < k && pool.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i]!;
      let maxSim = 0;
      for (const s of selected) {
        if (c.vector.length !== s.vector.length) continue;
        maxSim = Math.max(maxSim, cosineSimilarity(c.vector, s.vector));
      }
      const val = lambda * c.score - (1 - lambda) * maxSim;
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    }
    selected.push(pool.splice(bestIdx, 1)[0]!);
  }
  return selected.map((s) => s.item);
}
