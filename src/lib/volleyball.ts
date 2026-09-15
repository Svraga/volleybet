export const VALID_VOLLEY_SCORES = [
  "3-0",
  "3-1",
  "3-2",
  "2-3",
  "1-3",
  "0-3"
] as const;

export type VolleyScore = typeof VALID_VOLLEY_SCORES[number];

export function isValidVolleyScore(score: string): boolean {
  if (!score) return false;
  return VALID_VOLLEY_SCORES.includes(score.trim() as VolleyScore);
}

export function parseVolleyScore(score: string): { setA: number; setB: number } | null {
  if (!isValidVolleyScore(score)) return null;
  const [a, b] = score.trim().split("-").map(Number);
  if (isNaN(a) || isNaN(b)) return null;
  return { setA: a, setB: b };
}
