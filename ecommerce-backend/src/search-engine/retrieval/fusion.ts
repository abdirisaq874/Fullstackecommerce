/**
 * Reciprocal Rank Fusion — combines several ranked id lists (lexical, vector)
 * into one. Rank-based, so it needs no score normalization across retrievers.
 * k=60 is the standard constant from the original RRF paper.
 */
export function reciprocalRankFusion(rankedLists: string[][], k = 60): string[] {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    list.forEach((id, idx) => {
      scores.set(id, (scores.get(id) || 0) + 1 / (k + idx + 1));
    });
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
