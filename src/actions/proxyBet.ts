"use server"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

import { isValidVolleyScore, parseVolleyScore } from "@/lib/volleyball"

export async function proxyPlaceBets(leagueId: string, matchDayId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.adminId !== session.user.id) throw new Error("Unauthorized")

  const targetUserId = formData.get("userId") as string
  if (!targetUserId) throw new Error("Missing target user ID")

  const targetUser = await prisma.user.findUnique({ 
    where: { id: targetUserId },
    include: { leagues: true }
  })
  if (!targetUser || !targetUser.leagues.some(l => l.id === leagueId)) throw new Error("Target user does not belong to this league")

  const matchDay = await prisma.matchDay.findUnique({
    where: { id: matchDayId },
    include: { matches: true }
  })

  // Prevent cross-tenant IDOR
  if (!matchDay || matchDay.leagueId !== leagueId) {
    throw new Error("Matchday non appartenente a questo campionato")
  }

  if (matchDay.status !== "OPEN") throw new Error("Matchday non aperto")

  if (new Date() > matchDay.deadline) {
    throw new Error("Deadline passed: Impossibile inserire proxy bets oltre l'orario di scadenza")
  }

  const member = await prisma.leagueMember.findUnique({
    where: {
      userId_leagueId: {
        userId: targetUserId,
        leagueId: leagueId,
      },
    },
  })
  const targetUserTeam = member?.teamName || league.homeTeam

  const betsToCreate: { matchId: string, predictedA: number, predictedB: number }[] = []
  
  for (const match of matchDay.matches) {
    if (match.teamA === targetUserTeam || match.teamB === targetUserTeam) {
      const betVal = formData.get(`bet_${match.id}`) as string
      if (betVal) {
        throw new Error(`Forbidden: Non puoi scommettere sulla squadra di appartenenza (${targetUserTeam}) per conto del giocatore`)
      }
      continue
    }

    const betVal = formData.get(`bet_${match.id}`) as string
    if (betVal) {
      if (!isValidVolleyScore(betVal)) {
        throw new Error(`Punteggio non valido per la partita: ${betVal}`)
      }
      const parsed = parseVolleyScore(betVal)
      if (parsed) {
        betsToCreate.push({
          matchId: match.id,
          predictedA: parsed.setA,
          predictedB: parsed.setB,
        })
      }
    }
  }

  if (betsToCreate.length > 0) {
    await prisma.$transaction(async (tx) => {
      // Upsert bets to avoid Unique Constraint 500 errors
      for (const b of betsToCreate) {
        await tx.bet.upsert({
          where: {
            userId_matchId: {
              userId: targetUserId,
              matchId: b.matchId
            }
          },
          update: {
            predictedA: b.predictedA,
            predictedB: b.predictedB
          },
          create: {
            userId: targetUserId,
            matchId: b.matchId,
            predictedA: b.predictedA,
            predictedB: b.predictedB
          }
        })
      }

      // Handle Ledger: only charge if it doesn't exist
      const existingLedger = await tx.ledger.findFirst({
        where: {
          userId: targetUserId,
          leagueId,
          matchDayId,
          reason: { contains: "Entry Fee" }
        }
      })

      if (!existingLedger) {
        await tx.ledger.create({
          data: {
            userId: targetUserId,
            leagueId,
            matchDayId,
            amount: -1,
            reason: `MatchDay ${matchDay.number} Entry Fee (Proxy)`
          }
        })
      }

      // Log the proxy bet
      await tx.auditLog.create({
        data: {
          leagueId,
          userId: session.user.id,
          action: "Scommessa Proxy",
          details: `L'admin ha inserito scommesse per conto di ${targetUser.name || 'Utente'}`
        }
      })

      // Notify the target user
      await tx.notification.create({
        data: {
          userId: targetUserId,
          leagueId,
          message: `L'amministratore ha inserito i tuoi pronostici per la Giornata ${matchDay.number} (Proxy Bet).`,
          type: "PROXY_BET"
        }
      })
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    })
  }

  redirect(`/league/${leagueId}/admin`)
}
