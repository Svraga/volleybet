"use server"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { isValidVolleyScore, parseVolleyScore } from "@/lib/volleyball"

export async function scoreMatchDay(leagueId: string, matchDayId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.adminId !== session.user.id) throw new Error("Unauthorized")

  const matchDay = await prisma.matchDay.findUnique({
    where: { id: matchDayId },
    include: { matches: { include: { bets: true } } }
  })

  if (!matchDay || matchDay.leagueId !== leagueId) {
    throw new Error("Matchday non trovato o non appartenente a questo campionato")
  }

  // Parse and validate match results
  const matchesToUpdate: { id: string; resultA: number; resultB: number }[] = []
  for (const m of matchDay.matches) {
    const resultVal = (formData.get(`result_${m.id}`) as string)?.trim()
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

  await prisma.$transaction(async (tx) => {
    // 1. Clean up old payouts and refunds if re-scoring
    if (isRescore) {
      await tx.ledger.deleteMany({
        where: { matchDayId: matchDay.id, amount: { gt: 0 } }
      })
    }

    // 2. Update matches and bets
    let userPoints: Record<string, number> = {} // userId -> points
    let userBetsCount: Record<string, number> = {}

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

        await tx.bet.update({
          where: { id: bet.id },
          data: { pointsEarned: points }
        })

        userPoints[bet.userId] = (userPoints[bet.userId] || 0) + points
        userBetsCount[bet.userId] = (userBetsCount[bet.userId] || 0) + 1
      }
    }

    // 3. Calculate total pool from entry fee ledgers
    const betLedgers = await tx.ledger.findMany({
      where: { matchDayId: matchDay.id, amount: { lt: 0 } }
    })
    
    const totalPool = betLedgers.reduce((sum, l) => sum + Math.abs(l.amount), 0)

    if (totalPool > 0) {
      const usersWithBets = Object.keys(userPoints)
      const allZeros = usersWithBets.length > 0 && usersWithBets.every(uid => userPoints[uid] === 0)

      if (allZeros) {
        // Refund everyone exactly what they spent
        for (const uid of usersWithBets) {
          const userFeeLedger = betLedgers.find(l => l.userId === uid)
          const spent = userFeeLedger ? Math.abs(userFeeLedger.amount) : 1
          if (spent > 0) {
            await tx.ledger.create({
              data: {
                userId: uid,
                leagueId,
                matchDayId: matchDay.id,
                amount: spent,
                reason: "Refund (Everyone scored 0)"
              }
            })
          }
        }
      } else if (usersWithBets.length > 0) {
        // Group by points descending
        const sortedScores = Array.from(new Set(Object.values(userPoints))).sort((a, b) => b - a)
        let rankDistribution: Record<string, number> = {}

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
            await tx.ledger.create({
              data: {
                userId: uid,
                leagueId,
                matchDayId: matchDay.id,
                amount: coins,
                reason: `Payout MatchDay ${matchDay.number}`
              }
            })
          }
        }
      }
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
        userId: session.user.id,
        action: isRescore ? "Risultati Modificati" : "Risultati Inseriti",
        details: isRescore
          ? `Risultati e classifiche ricalcolati per la Giornata ${matchDay.number}`
          : `Risultati inseriti e premi distribuiti per la Giornata ${matchDay.number}`
      }
    })

    const users = await tx.user.findMany({ where: { leagues: { some: { id: leagueId } } } })
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
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  })

  revalidatePath(`/league/${leagueId}/admin`)
  revalidatePath(`/league/${leagueId}`)
  revalidatePath(`/league/${leagueId}/stats`)
  redirect(`/league/${leagueId}/admin`)
}
