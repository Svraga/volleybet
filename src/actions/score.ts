"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { isValidVolleyScore, parseVolleyScore } from "@/lib/volleyball"
import { consumeRateLimit, formText, requireId, requireUserId, withLeagueTransaction } from "@/lib/security"

export async function scoreMatchDay(leagueId: string, matchDayId: string, formData: FormData) {
  const userId = await requireUserId()
  requireId(matchDayId)
  await consumeRateLimit(userId, "scoring", 20, 60000)

  await withLeagueTransaction(leagueId, userId, "admin", async (tx) => {
    const matchDay = await tx.matchDay.findUnique({
      where: { id: matchDayId },
      include: { matches: { include: { bets: true } } }
    })

    if (!matchDay || matchDay.leagueId !== leagueId) {
      throw new Error("Matchday non trovato o non appartenente a questo campionato")
    }

    if (Date.now() < matchDay.deadline.getTime()) throw new Error("Attendi la scadenza prima di inserire i risultati")
    if (!matchDay.matches.length) throw new Error("La giornata non contiene partite")

    // Parse and validate match results
    const matchesToUpdate: { id: string; resultA: number; resultB: number }[] = []
    for (const m of matchDay.matches) {
      const resultVal = formText(formData, `result_${m.id}`, 3)
      if (!resultVal) {
        throw new Error("Devi inserire tutti i risultati prima di procedere")
      }
      if (!isValidVolleyScore(resultVal)) {
        throw new Error(`Risultato non valido: ${resultVal}. Punteggi ammessi: 3-0, 3-1, 3-2, 2-3, 1-3, 0-3`)
      }
      const parsed = parseVolleyScore(resultVal)
      if (!parsed) {
        throw new Error(`Errore nel parsing del punteggio: ${resultVal}`)
      }
      matchesToUpdate.push({
        id: m.id,
        resultA: parsed.setA,
        resultB: parsed.setB
      })
    }

    const isRescore = matchDay.status === "SCORED"

    // 1. Clean up old payouts and refunds if re-scoring
    await tx.ledger.deleteMany({
      where: { leagueId, matchDayId: matchDay.id, amount: { gt: 0 } }
    })

    // 2. Update matches and bets
    const userPoints: Record<string, number> = {} // userId -> points
    const betIdsByPoints = new Map<number, string[]>([[0, []], [1, []], [3, []]])
    const credits: Prisma.LedgerCreateManyInput[] = []

    for (const matchUpdate of matchesToUpdate) {
      await tx.match.update({
        where: { id: matchUpdate.id },
        data: { resultA: matchUpdate.resultA, resultB: matchUpdate.resultB }
      })

      const match = matchDay.matches.find(m => m.id === matchUpdate.id)!
      const signActual = matchUpdate.resultA > matchUpdate.resultB ? 1 : 2

      for (const bet of match.bets) {
        let points = 0
        if (bet.predictedA === matchUpdate.resultA && bet.predictedB === matchUpdate.resultB) {
          points = 3
        } else {
          const signPredicted = bet.predictedA > bet.predictedB ? 1 : 2
          if (signPredicted === signActual) points = 1
        }

        betIdsByPoints.get(points)!.push(bet.id)

        userPoints[bet.userId] = (userPoints[bet.userId] || 0) + points
      }
    }

    // Batch equal scores instead of making one database round trip per prediction.
    // Chunk IDs to keep large days below the database parameter limit.
    for (const [pointsEarned, ids] of betIdsByPoints) {
      for (let start = 0; start < ids.length; start += 1000) {
        await tx.bet.updateMany({
          where: { id: { in: ids.slice(start, start + 1000) } },
          data: { pointsEarned }
        })
      }
    }

    // 3. Calculate total pool from entry fee ledgers
    const betLedgers = await tx.ledger.findMany({
      where: { leagueId, matchDayId: matchDay.id, amount: { lt: 0 } }
    })
    
    const feesByUser: Record<string, number> = {}
    for (const fee of betLedgers) feesByUser[fee.userId] = (feesByUser[fee.userId] || 0) + Math.abs(fee.amount)
    // Refund legacy fees without predictions instead of donating them to other players.
    for (const [uid, spent] of Object.entries(feesByUser)) {
      if (!(uid in userPoints)) credits.push({
        userId: uid, leagueId, matchDayId: matchDay.id, amount: spent, reason: "Refund (No predictions)"
      })
    }
    const totalPool = Object.entries(feesByUser).reduce((sum, [uid, spent]) => uid in userPoints ? sum + spent : sum, 0)

    if (totalPool > 0) {
      const usersWithBets = Object.keys(userPoints).filter(uid => feesByUser[uid] > 0)
      const allZeros = usersWithBets.length > 0 && usersWithBets.every(uid => userPoints[uid] === 0)

      if (allZeros) {
        // Refund everyone exactly what they spent
        for (const uid of usersWithBets) {
          const spent = feesByUser[uid]
          if (spent > 0) {
            credits.push({
              userId: uid,
              leagueId,
              matchDayId: matchDay.id,
              amount: spent,
              reason: "Refund (Everyone scored 0)"
            })
          }
        }
      } else if (usersWithBets.length > 0) {
        // Group by points descending
        const sortedScores = Array.from(new Set(usersWithBets.map(uid => userPoints[uid]))).sort((a, b) => b - a)
        const rankDistribution: Record<string, number> = {}

        const firstScore = sortedScores[0]
        const firstPlaceUsers = usersWithBets.filter(u => userPoints[u] === firstScore)

        if (firstPlaceUsers.length === 1) {
          // Exactly 1 winner
          const u1 = firstPlaceUsers[0]
          let totalSecondPlacePayout = 0

          if (sortedScores.length > 1 && totalPool >= 3) {
            // Only reward 2nd place if pool >= 3 to protect winner's profit
            const secondScore = sortedScores[1]
            const secondPlaceUsers = usersWithBets.filter(u => userPoints[u] === secondScore)

            // Cap total second place payout so winner always gets at least half the pool and at least 2 coins
            const maxSecondPlacePool = Math.min(secondPlaceUsers.length, Math.floor((totalPool - 1) / 2))
            
            if (maxSecondPlacePool > 0) {
              const payoutPerSecond = maxSecondPlacePool / secondPlaceUsers.length
              for (const u2 of secondPlaceUsers) {
                rankDistribution[u2] = payoutPerSecond
                totalSecondPlacePayout += payoutPerSecond
              }
            }
          }

          rankDistribution[u1] = Math.max(1, totalPool - totalSecondPlacePayout)
        } else {
          // Multiple first places: split pool equally
          const splitAmount = totalPool / firstPlaceUsers.length
          for (const u of firstPlaceUsers) {
            rankDistribution[u] = splitAmount
          }
        }

        // Apply payouts
        for (const [uid, coins] of Object.entries(rankDistribution)) {
          if (coins > 0) {
            credits.push({
              userId: uid,
              leagueId,
              matchDayId: matchDay.id,
              amount: coins,
              reason: `Payout MatchDay ${matchDay.number}`
            })
          }
        }
      }
    }

    // Keep payouts and refunds atomic with results, including when re-scoring.
    for (let start = 0; start < credits.length; start += 1000) {
      await tx.ledger.createMany({ data: credits.slice(start, start + 1000) })
    }

    // Set MatchDay status to SCORED
    await tx.matchDay.update({
      where: { id: matchDay.id },
      data: { status: "SCORED" }
    })

    // Log the action
    await tx.auditLog.create({
      data: {
        leagueId,
        userId: userId,
        action: isRescore ? "Risultati Modificati" : "Risultati Inseriti",
        details: isRescore
          ? `Risultati e classifiche ricalcolati per la Giornata ${matchDay.number}`
          : `Risultati inseriti e premi distribuiti per la Giornata ${matchDay.number}`
      }
    })

    const users = await tx.user.findMany({ where: { leagues: { some: { id: leagueId } } }, select: { id: true } })
    await tx.notification.createMany({
      data: users.map(u => ({
        userId: u.id,
        leagueId,
        message: isRescore
          ? `Attenzione: I risultati e le classifiche della Giornata ${matchDay.number} sono stati aggiornati dall'amministratore!`
          : `Sono stati pubblicati i risultati e le classifiche della Giornata ${matchDay.number}!`,
        type: "SCORED"
      }))
    })
  })

  revalidatePath(`/league/${leagueId}/admin`)
  revalidatePath(`/league/${leagueId}`)
  revalidatePath(`/league/${leagueId}/stats`)
  revalidatePath(`/league/${leagueId}/predictions`)
  redirect(`/league/${leagueId}/admin`)
}
