"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { assertBettingOpen, consumeRateLimit, formText, requireId, requireUserId, withLeagueTransaction } from "@/lib/security"
import type { Prisma } from "@prisma/client"

function futureDeadline(form: FormData) {
  const deadline = new Date(formText(form, "deadline", 40))
  if (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now()) throw new Error("La scadenza deve essere una data futura valida")
  return deadline
}

async function editableDay(tx: Prisma.TransactionClient, leagueId: string, dayId: string) {
  const day = await tx.matchDay.findFirst({ where: { id: requireId(dayId), leagueId } })
  if (!day) throw new Error("Giornata non appartenente a questo campionato")
  assertBettingOpen(day)
  return day
}

async function assertNoEntries(tx: Prisma.TransactionClient, leagueId: string, matchDayId: string) {
  const bets = await tx.bet.count({ where: { match: { matchDayId } } })
  const fees = await tx.ledger.count({ where: { leagueId, matchDayId } })
  if (bets || fees) throw new Error("Non puoi modificare gli accoppiamenti dopo il primo pronostico")
}

function refresh(leagueId: string) {
  revalidatePath(`/league/${leagueId}/admin`)
  revalidatePath(`/league/${leagueId}`)
}

export async function createMatchDay(leagueId: string, formData: FormData) {
  const userId = await requireUserId()
  await consumeRateLimit(userId, "create-matchday", 30, 3600000)
  const raw = formText(formData, "number", 6)
  const number = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(number) || number < 1 || number > 100000) throw new Error("Numero giornata non valido")
  const deadline = futureDeadline(formData)
  await withLeagueTransaction(leagueId, userId, "admin", async tx => {
    if (await tx.matchDay.findFirst({ where: { leagueId, number } })) throw new Error("Questa giornata esiste già")
    if (await tx.matchDay.count({ where: { leagueId } }) >= 1000) throw new Error("Limite di giornate raggiunto")
    await tx.matchDay.create({ data: { leagueId, number, deadline } })
    await tx.auditLog.create({ data: { leagueId, userId, action: "Creata Giornata", details: `Giornata ${number} creata.` } })
    const users = await tx.user.findMany({ where: { leagues: { some: { id: leagueId } } }, select: { id: true } })
    await tx.notification.createMany({ data: users.map(u => ({
      userId: u.id, leagueId, type: "MATCHDAY_CREATED",
      message: `È stata aperta la Giornata ${number}. Scadenza: ${deadline.toLocaleString("it-IT")}.`,
    })) })
    if (Date.now() >= deadline.getTime()) throw new Error("Scadenza superata")
  })
  refresh(leagueId)
  redirect(`/league/${leagueId}/admin`)
}

export async function setMatches(leagueId: string, matchDayId: string, formData: FormData) {
  const userId = await requireUserId()
  const raw = formText(formData, "numRows", 3)
  const numRows = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(numRows) || numRows < 1 || numRows > 32) throw new Error("Numero di partite non valido")
  const restingTeam = formText(formData, "restingTeam", 20, false) || null
  await withLeagueTransaction(leagueId, userId, "admin", async tx => {
    const day = await editableDay(tx, leagueId, matchDayId)
    await assertNoEntries(tx, leagueId, matchDayId)
    const teams = await tx.team.findMany({ where: { leagueId }, select: { name: true } })
    if (numRows !== Math.floor(teams.length / 2)) throw new Error("Numero di partite non coerente con le squadre")
    const allowed = new Set(teams.map(t => t.name))
    const used = new Set<string>()
    const matches: { matchDayId: string; teamA: string; teamB: string }[] = []
    for (let i = 0; i < numRows; i++) {
      const teamA = formText(formData, `teamA_${i}`, 20)
      const teamB = formText(formData, `teamB_${i}`, 20)
      if (!allowed.has(teamA) || !allowed.has(teamB) || teamA === teamB || used.has(teamA) || used.has(teamB)) throw new Error("Accoppiamento non valido o squadra duplicata")
      used.add(teamA); used.add(teamB)
      matches.push({ matchDayId, teamA, teamB })
    }
    if (teams.length % 2 !== 0) {
      if (!restingTeam || !allowed.has(restingTeam) || used.has(restingTeam)) throw new Error("Squadra a riposo non valida")
    } else if (restingTeam) throw new Error("Nessuna squadra deve riposare")
    await tx.match.deleteMany({ where: { matchDayId } })
    await tx.matchDay.update({ where: { id: matchDayId }, data: { restingTeam } })
    await tx.match.createMany({ data: matches })
    await tx.auditLog.create({ data: { leagueId, userId, action: "Modificate Partite", details: `Giornata ${day.number}: impostate ${numRows} partite.` } })
    assertBettingOpen(day)
  })
  refresh(leagueId)
  redirect(`/league/${leagueId}/admin`)
}

export async function addMatch(leagueId: string, matchDayId: string, formData: FormData) {
  const userId = await requireUserId()
  const teamA = formText(formData, "teamA", 20)
  const teamB = formText(formData, "teamB", 20)
  if (teamA === teamB) throw new Error("Una squadra non può giocare contro se stessa")
  await withLeagueTransaction(leagueId, userId, "admin", async tx => {
    const day = await editableDay(tx, leagueId, matchDayId)
    await assertNoEntries(tx, leagueId, matchDayId)
    const teams = await tx.team.findMany({ where: { leagueId }, select: { name: true } })
    if (!teams.some(t => t.name === teamA) || !teams.some(t => t.name === teamB) || day.restingTeam === teamA || day.restingTeam === teamB) throw new Error("Squadra non valida")
    if (await tx.match.count({ where: { matchDayId, OR: [{ teamA: { in: [teamA, teamB] } }, { teamB: { in: [teamA, teamB] } }] } })) throw new Error("Squadra già impegnata")
    await tx.match.create({ data: { matchDayId, teamA, teamB } })
    await tx.auditLog.create({ data: { leagueId, userId, action: "Aggiunta Partita", details: `Giornata ${day.number}: ${teamA} - ${teamB}.` } })
    assertBettingOpen(day)
  })
  refresh(leagueId)
  redirect(`/league/${leagueId}/admin`)
}

export async function deleteMatchDay(leagueId: string, matchDayId: string) {
  const userId = await requireUserId()
  await withLeagueTransaction(leagueId, userId, "admin", async tx => {
    const day = await editableDay(tx, leagueId, matchDayId)
    await tx.bet.deleteMany({ where: { match: { matchDayId } } })
    await tx.ledger.deleteMany({ where: { leagueId, matchDayId } })
    await tx.match.deleteMany({ where: { matchDayId } })
    await tx.matchDay.delete({ where: { id: matchDayId } })
    await tx.auditLog.create({ data: { leagueId, userId, action: "Eliminata Giornata", details: `Giornata ${day.number} eliminata e quote annullate.` } })
    assertBettingOpen(day)
  })
  refresh(leagueId)
}

export async function updateDeadline(leagueId: string, matchDayId: string, formData: FormData) {
  const userId = await requireUserId()
  const deadline = futureDeadline(formData)
  await withLeagueTransaction(leagueId, userId, "admin", async tx => {
    const day = await editableDay(tx, leagueId, matchDayId)
    await tx.matchDay.update({ where: { id: matchDayId }, data: { deadline } })
    await tx.auditLog.create({ data: {
      leagueId, userId, action: "Modificata Scadenza",
      details: `Giornata ${day.number}: da ${day.deadline.toISOString()} a ${deadline.toISOString()}.`,
    } })
    const users = await tx.user.findMany({ where: { leagues: { some: { id: leagueId } } }, select: { id: true } })
    await tx.notification.createMany({ data: users.map(u => ({
      userId: u.id, leagueId, type: "DEADLINE_CHANGED",
      message: `La scadenza della Giornata ${day.number} è stata modificata al ${deadline.toLocaleString("it-IT")}.`,
    })) })
    // Neither the old nor the new deadline may pass during this operation.
    assertBettingOpen(day)
    if (Date.now() >= deadline.getTime()) throw new Error("Scadenza superata")
  })
  refresh(leagueId)
  redirect(`/league/${leagueId}/admin`)
}
