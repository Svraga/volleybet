"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function scoreMatchDay(leagueId: string, matchDayId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.adminId !== session.user.id) throw new Error("Unauthorized")

  const matchDay = await prisma.matchDay.findUnique({
    where: { id: matchDayId },
    include: { matches: { include: { bets: true } } }
  })

  if (!matchDay) throw new Error("Matchday not found")

  // Update match results
  const matchesToUpdate = matchDay.matches.map(m => {
    const resultVal = formData.get(`result_${m.id}`) as string
    if (resultVal) {
      const [resA, resB] = resultVal.split("-").map(Number)
      return { id: m.id, resultA: resA, resultB: resB }
    }
    return null
  }).filter(Boolean) as { id: string, resultA: number, resultB: number }[]

  if (matchesToUpdate.length !== matchDay.matches.length) {
    throw new Error("Devi inserire tutti i risultati")
  }

  await prisma.$transaction(async (tx) => {
    // 0. If already scored, remove old payouts and refunds
    if (matchDay.status === "SCORED") {
      await tx.ledger.deleteMany({
        where: { matchDayId: matchDay.id, amount: { gt: 0 } }
      })
    }

    // 1. Update matches and bets
    let userPoints: Record<string, number> = {} // userId -> points
    let userBetsCount: Record<string, number> = {} // userId -> number of bets

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

    // Calculate total pool (from ledgers to be exact, but it's equal to total bets since 1 bet = 1 coin)
    // Find how many coins were spent this matchday
    const betLedgers = await tx.ledger.findMany({
      where: { matchDayId: matchDay.id, amount: { lt: 0 } }
    })
    
    const totalPool = betLedgers.reduce((sum, l) => sum + Math.abs(l.amount), 0)

    if (totalPool > 0) {
      const usersWithBets = Object.keys(userPoints)
      const allZeros = usersWithBets.every(uid => userPoints[uid] === 0)

      if (allZeros) {
        // Refund everyone exactly what they spent
        for (const uid of usersWithBets) {
          const spent = userBetsCount[uid] || 0
          if (spent > 0) {
            await tx.ledger.create({
              data: {
                userId: uid,
                leagueId,
                matchDayId,
                amount: spent,
                reason: "Refund (Everyone scored 0)"
              }
            })
          }
        }
      } else {
        // Group by points and sort descending
        const sortedScores = Array.from(new Set(Object.values(userPoints))).sort((a, b) => b - a)
        
        let rankDistribution: Record<string, number> = {} // userId -> coins won
        
        const firstScore = sortedScores[0]
        const firstPlaceUsers = usersWithBets.filter(u => userPoints[u] === firstScore)

        if (firstPlaceUsers.length === 1) {
            // ONLY ONE FIRST PLACE
            const u1 = firstPlaceUsers[0]
            
            // Check if there is a second place
            let totalSecondPlacePayout = 0
            if (sortedScores.length > 1) {
                const secondScore = sortedScores[1]
                const secondPlaceUsers = usersWithBets.filter(u => userPoints[u] === secondScore)
                
                for (const u2 of secondPlaceUsers) {
                    const spent = userBetsCount[u2] || 0
                    const payout = spent + 1
                    rankDistribution[u2] = payout
                    totalSecondPlacePayout += payout
                }
            }

            // 1st place takes the rest
            rankDistribution[u1] = Math.max(0, totalPool - totalSecondPlacePayout)
        } else {
            // MULTIPLE FIRST PLACES (EX-AEQUO)
            const splitAmount = totalPool / firstPlaceUsers.length
            for (const u of firstPlaceUsers) {
                rankDistribution[u] = splitAmount
            }
            // 2nd places get 0.
        }

        // Apply payouts
        for (const [uid, coins] of Object.entries(rankDistribution)) {
          if (coins > 0) {
            await tx.ledger.create({
              data: {
                userId: uid,
                leagueId,
                matchDayId,
                amount: coins,
                reason: `Payout MatchDay ${matchDay.number}`
              }
            })
          }
        }
      }
    }

    // Close MatchDay
    await tx.matchDay.update({
      where: { id: matchDay.id },
      data: { status: "SCORED" }
    })
  })

  redirect(`/league/${leagueId}/admin`)
}
