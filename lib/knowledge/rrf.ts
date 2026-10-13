/** Reciprocal Rank Fusion. Rank is 1-based. Higher score is more relevant. */
export const RRF_K = 60;

export function reciprocalRankFusion(
  rankedLists: string[][],
  k = RRF_K
): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    const seen = new Set<string>();
    for (const id of list) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const rank = seen.size;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    }
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
