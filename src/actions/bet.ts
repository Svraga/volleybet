"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function placeBets(leagueId: string, matchDayId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const user = await prisma.user.findUnique({ 
    where: { id: session.user.id },
    include: { leagues: true }
  })
  if (!user || !user.leagues.some(l => l.id === leagueId)) throw new Error("Forbidden: Non appartieni a questa lega (403)")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league) throw new Error("League not found")

  const matchDay = await prisma.matchDay.findUnique({
    where: { id: matchDayId },
    include: { matches: true }
  })

  if (!matchDay || matchDay.status !== "OPEN") {
    throw new Error("Matchday is closed or not found")
  }

  if (new Date() > matchDay.deadline) {
    throw new Error("Deadline passed")
  }

  // Parse bets from formData
  // We expect a select named `bet_${match.id}` which contains values like "3-0", "1-3", etc.
  const betsToCreate: { matchId: string, predictedA: number, predictedB: number }[] = []
  
  for (const match of matchDay.matches) {
    // Check if home team is playing
    if (match.teamA === league.homeTeam || match.teamB === league.homeTeam) {
      const betVal = formData.get(`bet_${match.id}`) as string
      if (betVal) {
        throw new Error("Forbidden: Non puoi scommettere sulla squadra di casa (403)")
      }
      continue // skip if no bet provided
    }

    const betVal = formData.get(`bet_${match.id}`) as string
    if (betVal) {
      const [resA, resB] = betVal.split("-").map(Number)
      if (!isNaN(resA) && !isNaN(resB)) {
        betsToCreate.push({
          matchId: match.id,
          predictedA: resA,
          predictedB: resB,
        })
      }
    }
  }

  if (betsToCreate.length === 0) {
    redirect(`/league/${leagueId}/matchday/${matchDayId}?error=No bets placed`)
  }

  // Transaction to place bets and deduct coins
  await prisma.$transaction(async (tx) => {
    for (const b of betsToCreate) {
      // Upsert bet
      await tx.bet.upsert({
        where: {
          userId_matchId: {
            userId: session.user.id,
            matchId: b.matchId
          }
        },
        update: {
          predictedA: b.predictedA,
          predictedB: b.predictedB
        },
        create: {
          userId: session.user.id,
          matchId: b.matchId,
          predictedA: b.predictedA,
          predictedB: b.predictedB
        }
      })
    }

    // Charge exactly 1 Coin for the whole MatchDay
    const existingLedger = await tx.ledger.findFirst({
      where: {
        userId: session.user.id,
        leagueId: leagueId,
        matchDayId: matchDayId,
        reason: `MatchDay ${matchDay.number} Entry Fee`
      }
    })
    
    if (!existingLedger) {
      await tx.ledger.create({
        data: {
          userId: session.user.id,
          leagueId: leagueId,
          matchDayId: matchDayId,
          amount: -1,
          reason: `MatchDay ${matchDay.number} Entry Fee`
        }
      })
    }
  })

  redirect(`/league/${leagueId}`)
}
