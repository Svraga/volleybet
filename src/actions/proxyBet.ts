"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function proxyPlaceBets(leagueId: string, matchDayId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.adminId !== session.user.id) throw new Error("Unauthorized")

  const targetUserId = formData.get("userId") as string
  if (!targetUserId) throw new Error("Missing target user ID")

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
  if (!targetUser || targetUser.leagueId !== leagueId) throw new Error("Target user does not belong to this league")

  const matchDay = await prisma.matchDay.findUnique({
    where: { id: matchDayId },
    include: { matches: true }
  })

  if (!matchDay || matchDay.status !== "OPEN") throw new Error("Matchday not open")

  const bets: { userId: string, matchId: string, predictedA: number, predictedB: number }[] = []
  for (const match of matchDay.matches) {
    const betVal = formData.get(`bet_${match.id}`) as string
    if (betVal) {
      const [predA, predB] = betVal.split("-").map(Number)
      bets.push({
        userId: targetUserId,
        matchId: match.id,
        predictedA: predA,
        predictedB: predB,
      })
    }
  }

  if (bets.length > 0) {
    await prisma.$transaction(async (tx) => {
      // Create bets
      await tx.bet.createMany({
        data: bets
      })

      // Create ledger entry for the target user (-1 coin for matchday entry)
      await tx.ledger.create({
        data: {
          userId: targetUserId,
          leagueId,
          matchDayId,
          amount: -1,
          reason: `MatchDay ${matchDay.number} Entry Fee (Proxy)`
        }
      })
    })
  }

  redirect(`/league/${leagueId}/admin`)
}
