"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export async function createMatchDay(leagueId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const number = parseInt(formData.get("number") as string)
  const deadlineStr = formData.get("deadline") as string
  if (!number || number <= 0 || !deadlineStr) {
    throw new Error("Dati mancanti o numero giornata non valido")
  }

  const deadline = new Date(deadlineStr)
  if (isNaN(deadline.getTime())) {
    throw new Error("Data di scadenza non valida")
  }

  if (deadline <= new Date()) {
    throw new Error("La scadenza deve essere una data futura")
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.adminId !== session.user.id) throw new Error("Unauthorized")

  // Check if a matchday with this number already exists
  const existingMd = await prisma.matchDay.findFirst({
    where: { leagueId, number }
  })
  if (existingMd) {
    throw new Error(`La Giornata ${number} esiste già in questo campionato.`)
  }

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
        details: `Giornata ${number} creata con scadenza ${deadline.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}`
      }
    })

    const users = await tx.user.findMany({ where: { leagues: { some: { id: leagueId } } } })
    await tx.notification.createMany({
      data: users.map(u => ({
        userId: u.id,
        leagueId,
        message: `È stata aperta la Giornata ${number}. Scadenza: ${deadline.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}`,
        type: "MATCHDAY_CREATED"
      }))
    })
  })

  revalidatePath(`/league/${leagueId}/admin`)
  revalidatePath(`/league/${leagueId}`)
  redirect(`/league/${leagueId}/admin`)
}

export async function addMatch(leagueId: string, matchDayId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const teamA = (formData.get("teamA") as string)?.trim()
  const teamB = (formData.get("teamB") as string)?.trim()

  if (!teamA || !teamB) throw new Error("Campi obbligatori mancanti")
  if (teamA === teamB) throw new Error("Una squadra non può giocare contro se stessa")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.adminId !== session.user.id) throw new Error("Unauthorized")

  const matchDay = await prisma.matchDay.findUnique({ where: { id: matchDayId } })
  if (!matchDay || matchDay.leagueId !== leagueId) {
    throw new Error("Matchday non appartenente a questo campionato")
  }

  if (matchDay.status !== "OPEN") {
    throw new Error("Non puoi aggiungere partite a una giornata chiusa o già calcolata")
  }

  if (new Date() > matchDay.deadline) {
    throw new Error("Non puoi aggiungere partite oltre la scadenza della giornata")
  }

  await prisma.match.create({
    data: {
      matchDayId,
      teamA,
      teamB
    }
  })

  revalidatePath(`/league/${leagueId}/admin`)
  redirect(`/league/${leagueId}/admin`)
}

export async function setMatches(leagueId: string, matchDayId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.adminId !== session.user.id) throw new Error("Unauthorized")

  const matchDay = await prisma.matchDay.findUnique({ where: { id: matchDayId } })
  if (!matchDay || matchDay.leagueId !== leagueId) {
    throw new Error("Matchday non appartenente a questo campionato")
  }

  if (matchDay.status !== "OPEN") {
    throw new Error("Non puoi modificare partite di una giornata chiusa o calcolata")
  }

  if (new Date() > matchDay.deadline) {
    throw new Error("Scadenza superata: impossibile modificare gli accoppiamenti")
  }

  const numRows = parseInt(formData.get("numRows") as string)
  if (!numRows) return;

  const restingTeam = (formData.get("restingTeam") as string)?.trim() || null

  const newMatches: { matchDayId: string, teamA: string, teamB: string }[] = []
  for (let i = 0; i < numRows; i++) {
    const teamA = (formData.get(`teamA_${i}`) as string)?.trim()
    const teamB = (formData.get(`teamB_${i}`) as string)?.trim()
    if (teamA && teamB) {
      if (teamA === teamB) {
        throw new Error(`La squadra ${teamA} non può giocare contro se stessa`)
      }
      newMatches.push({
        matchDayId,
        teamA,
        teamB
      })
    }
  }

  if (newMatches.length === 0) {
    throw new Error("Inserisci almeno un accoppiamento valido")
  }

  await prisma.$transaction(async (tx) => {
    // Clean up previous matches and associated bets if updating pairings
    const previousMatches = await tx.match.findMany({ where: { matchDayId } })
    if (previousMatches.length > 0) {
      const matchIds = previousMatches.map(m => m.id)
      await tx.bet.deleteMany({ where: { matchId: { in: matchIds } } })
      await tx.match.deleteMany({ where: { matchDayId } })
    }

    await tx.matchDay.update({
      where: { id: matchDayId },
      data: { restingTeam }
    })

    await tx.match.createMany({
      data: newMatches
    })

    await tx.auditLog.create({
      data: {
        leagueId,
        userId: session.user.id,
        action: "Modificate Partite",
        details: `Giornata ${matchDay.number}: impostate ${newMatches.length} partite. (Riposa: ${restingTeam || 'Nessuno'})`
      }
    })
  })

  revalidatePath(`/league/${leagueId}/admin`)
  revalidatePath(`/league/${leagueId}`)
  redirect(`/league/${leagueId}/admin`)
}

export async function deleteMatchDay(leagueId: string, matchDayId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.adminId !== session.user.id) throw new Error("Unauthorized")

  const matchDay = await prisma.matchDay.findUnique({ where: { id: matchDayId } })
  if (!matchDay || matchDay.leagueId !== leagueId) {
    throw new Error("MatchDay non trovato o non appartenente a questo campionato")
  }
  
  if (new Date() > matchDay.deadline) {
    throw new Error("Non puoi eliminare una giornata già iniziata.")
  }

  await prisma.$transaction(async (tx) => {
    const matches = await tx.match.findMany({ where: { matchDayId } })
    const matchIds = matches.map(m => m.id)

    await tx.bet.deleteMany({
      where: { matchId: { in: matchIds } }
    })

    await tx.match.deleteMany({
      where: { matchDayId }
    })

    await tx.ledger.deleteMany({
      where: { matchDayId }
    })

    await tx.notification.deleteMany({
      where: {
        leagueId,
        message: { startsWith: `È stata aperta la Giornata ${matchDay.number}.` }
      }
    })

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

  revalidatePath(`/league/${leagueId}/admin`)
  revalidatePath(`/league/${leagueId}`)
}

export async function updateDeadline(leagueId: string, matchDayId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const deadlineStr = formData.get("deadline") as string
  if (!deadlineStr) throw new Error("Data mancante")
  const deadline = new Date(deadlineStr)
  if (isNaN(deadline.getTime())) throw new Error("Data di scadenza non valida")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.adminId !== session.user.id) throw new Error("Unauthorized")

  const matchDay = await prisma.matchDay.findUnique({ where: { id: matchDayId } })
  if (!matchDay || matchDay.leagueId !== leagueId) {
    throw new Error("Giornata non appartenente a questo campionato")
  }

  if (matchDay.status !== "OPEN") throw new Error("Non puoi modificare la scadenza di una giornata chiusa o calcolata")

  await prisma.$transaction(async (tx) => {
    await tx.matchDay.update({
      where: { id: matchDayId },
      data: { deadline }
    })

    await tx.auditLog.create({
      data: {
        leagueId,
        userId: session.user.id,
        action: "Modificata Scadenza",
        details: `Scadenza della Giornata ${matchDay.number} spostata al ${deadline.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}`
      }
    })

    const users = await tx.user.findMany({ where: { leagues: { some: { id: leagueId } } } })
    await tx.notification.createMany({
      data: users.map(u => ({
        userId: u.id,
        leagueId,
        message: `Attenzione: La scadenza per la Giornata ${matchDay.number} è stata modificata al ${deadline.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}`,
        type: "DEADLINE_CHANGED"
      }))
    })
  })

  revalidatePath(`/league/${leagueId}/admin`)
  revalidatePath(`/league/${leagueId}`)
  redirect(`/league/${leagueId}/admin`)
}
