"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function createMatchDay(leagueId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const number = parseInt(formData.get("number") as string)
  const deadlineStr = formData.get("deadline") as string
  const deadline = new Date(deadlineStr)

  if (!number || !deadline) throw new Error("Missing required fields")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.adminId !== session.user.id) throw new Error("Unauthorized")

  await prisma.$transaction(async (tx) => {
    await tx.matchDay.create({
      data: {
        leagueId,
        number,
        deadline,
      }
    })

    await tx.auditLog.create({
      data: {
        leagueId,
        userId: session.user.id,
        action: "Creata Giornata",
        details: `Giornata ${number} creata con scadenza ${deadlineStr}`
      }
    })
  })

  redirect(`/league/${leagueId}/admin`)
}

export async function addMatch(leagueId: string, matchDayId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const teamA = formData.get("teamA") as string
  const teamB = formData.get("teamB") as string

  if (!teamA || !teamB) throw new Error("Missing required fields")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.adminId !== session.user.id) throw new Error("Unauthorized")

  await prisma.match.create({
    data: {
      matchDayId,
      teamA,
      teamB
    }
  })

  redirect(`/league/${leagueId}/admin`)
}

export async function setMatches(leagueId: string, matchDayId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.adminId !== session.user.id) throw new Error("Unauthorized")

  const numRows = parseInt(formData.get("numRows") as string)
  if (!numRows) return;

  const restingTeam = formData.get("restingTeam") as string

  if (restingTeam) {
    await prisma.matchDay.update({
      where: { id: matchDayId },
      data: { restingTeam }
    })
  }

  const newMatches = []
  for (let i = 0; i < numRows; i++) {
    const teamA = formData.get(`teamA_${i}`) as string
    const teamB = formData.get(`teamB_${i}`) as string
    if (teamA && teamB) {
      newMatches.push({
        matchDayId,
        teamA,
        teamB
      })
    }
  }

  await prisma.$transaction(async (tx) => {
    if (newMatches.length > 0) {
      await tx.match.createMany({
        data: newMatches
      })
    }

    await tx.auditLog.create({
      data: {
        leagueId,
        userId: session.user.id,
        action: "Modificate Partite",
        details: `Giornata aggiornata. ${newMatches.length} partite aggiunte. (Riposa: ${restingTeam || 'Nessuno'})`
      }
    })
  })

  redirect(`/league/${leagueId}/admin`)
}

export async function deleteMatchDay(leagueId: string, matchDayId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.adminId !== session.user.id) throw new Error("Unauthorized")

  const matchDay = await prisma.matchDay.findUnique({ where: { id: matchDayId } })
  if (!matchDay) throw new Error("MatchDay not found")
  
  if (new Date() > matchDay.deadline) {
    throw new Error("Non puoi eliminare una giornata già iniziata.")
  }

  await prisma.$transaction(async (tx) => {
    // Get all matches for this matchday
    const matches = await tx.match.findMany({ where: { matchDayId } })
    const matchIds = matches.map(m => m.id)

    // Delete all bets for these matches
    await tx.bet.deleteMany({
      where: { matchId: { in: matchIds } }
    })

    // Delete all matches
    await tx.match.deleteMany({
      where: { matchDayId }
    })

    // Delete all ledgers related to this matchday
    await tx.ledger.deleteMany({
      where: { matchDayId }
    })

    // Delete the matchday itself
    await tx.matchDay.delete({
      where: { id: matchDayId }
    })

    await tx.auditLog.create({
      data: {
        leagueId,
        userId: session.user.id,
        action: "Eliminata Giornata",
        details: `Giornata ${matchDay.number} eliminata`
      }
    })
  })

  redirect(`/league/${leagueId}/admin`)
}

