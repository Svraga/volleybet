"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { parseVolleyScore } from "@/lib/volleyball"
import { consumeRateLimit, formText, requireId, requireUserId, withLeagueTransaction } from "@/lib/security"
import { predictionPoints } from "@/lib/scoring"
import { settleMatchDay } from "@/lib/settlement"

export async function previewMatchDay(leagueId: string, matchDayId: string, formData: FormData) {
  const userId = await requireUserId()
  requireId(matchDayId)
  return withLeagueTransaction(leagueId, userId, "admin", async tx => {
    const day = await tx.matchDay.findFirst({
      where: { id: matchDayId, leagueId },
      include: { matches: { include: { bets: { select: { userId: true, predictedA: true, predictedB: true } } } } },
    })
    if (!day) throw new Error("Giornata non appartenente a questo campionato")
    if (Date.now() < day.deadline.getTime()) return { error: "Attendi la scadenza prima di vedere l'anteprima." }
    const points = new Map<string, number>()
    let completed = 0
    for (const match of day.matches) {
      for (const bet of match.bets) if (!points.has(bet.userId)) points.set(bet.userId, 0)
      const value = formText(formData, `result_${match.id}`, 3, false)
      if (!value) continue
      const score = parseVolleyScore(value)
      if (!score) return { error: "Uno dei risultati inseriti non è valido." }
      completed++
      for (const bet of match.bets) {
        points.set(bet.userId, (points.get(bet.userId) || 0) + predictionPoints(bet.predictedA, bet.predictedB, score.setA, score.setB))
      }
    }
    if (!completed) return { error: "Inserisci almeno un risultato per vedere l'anteprima." }
    const users = await tx.user.findMany({
      where: { OR: [{ leagues: { some: { id: leagueId } } }, { bets: { some: { match: { matchDayId } } } }] },
      select: { id: true, name: true },
    })
    return {
      completed, total: day.matches.length,
      ranking: users.map(u => ({ id: u.id, name: u.name || "Utente", points: points.get(u.id) || 0 }))
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "it")),
    }
  })
}

export async function scoreMatchDay(leagueId: string, matchDayId: string, formData: FormData) {
  const userId = await requireUserId()
  requireId(matchDayId)
  await consumeRateLimit(userId, "scoring", 20, 60000)

  await withLeagueTransaction(leagueId, userId, "admin", async (tx) => {
    await settleMatchDay(tx, leagueId, matchDayId, userId, formData)
  })

  revalidatePath(`/league/${leagueId}/admin`)
  revalidatePath(`/league/${leagueId}`)
  revalidatePath(`/league/${leagueId}/stats`)
  revalidatePath(`/league/${leagueId}/predictions`)
  redirect(`/league/${leagueId}/admin`)
}
