import "server-only"
import { createHmac } from "node:crypto"

// The persisted day seed makes the draw independent of query order and rescores.
// Every tied player gets the base share; distinct players receive the remainder.
export function splitWholeCoins(pool: number, userIds: string[], seed: string, group: string) {
  if (!Number.isSafeInteger(pool) || pool < 0 || !userIds.length || new Set(userIds).size !== userIds.length) {
    throw new Error("Montepremi o partecipanti non validi: sono ammessi solo coin interi")
  }
  const ranked = userIds.map(id => ({ id, draw: createHmac("sha256", seed).update(JSON.stringify([group, id])).digest("hex") }))
    .sort((a, b) => a.draw < b.draw ? -1 : a.draw > b.draw ? 1 : a.id.localeCompare(b.id))
  const base = Math.floor(pool / userIds.length)
  const remainder = pool % userIds.length
  return {
    amounts: Object.fromEntries(ranked.map((user, index) => [user.id, base + (index < remainder ? 1 : 0)])),
    extraCoinUserIds: ranked.slice(0, remainder).map(user => user.id),
  }
}
