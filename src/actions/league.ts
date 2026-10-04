"use server"

import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { randomBytes } from "crypto"
import { consumeRateLimit, formText, MAX_TEAMS, requireId, requireUserId, withLeagueTransaction } from "@/lib/security"

function inviteCode(raw: unknown) {
  if (typeof raw !== "string" || raw.length > 64) throw new Error("Codice invito non valido")
  const code = raw.trim().toUpperCase()
  if (!/^VOLLEY-[0-9A-F]{32}$/.test(code)) throw new Error("Codice invito non valido")
  return code
}

export async function createLeague(formData: FormData) {
  const userId = await requireUserId()
  await consumeRateLimit(userId, "create-league", 5, 3600000)
  const name = formText(formData, "name", 15)
  const homeTeam = formText(formData, "homeTeam", 20)
  const coinName = formText(formData, "coinName", 15, false) || "Coin"
  const entries = formData.getAll("teams[]")
  if (entries.length < 2 || entries.length > MAX_TEAMS) throw new Error("Numero di squadre non valido")
  if (entries.some(t => typeof t !== "string" || !t.trim() || t.length > 20)) throw new Error("Squadra non valida")
  const teams = entries.map(t => (t as string).trim())
  if (new Set(teams).size !== teams.length || !teams.includes(homeTeam)) throw new Error("Squadre duplicate o squadra di appartenenza non valida")
  const league = await prisma.$transaction(async tx => {
    // Serialize creation per user, so the ownership quota cannot be raced.
    await tx.user.update({ where: { id: userId }, data: { updatedAt: new Date() } })
    if (await tx.league.count({ where: { adminId: userId } }) >= 20) throw new Error("Hai raggiunto il limite di campionati")
    return tx.league.create({ data: {
      name, homeTeam, coinName, hasOddTeams: teams.length % 2 !== 0,
      inviteCode: "VOLLEY-" + randomBytes(16).toString("hex").toUpperCase(),
      adminId: userId,
      users: { connect: { id: userId } }, members: { create: { userId, teamName: homeTeam } },
      teams: { create: teams.map(name => ({ name })) },
    } })
  })
  revalidatePath("/")
  redirect(`/league/${league.id}`)
}

export async function getLeaguePreview(inviteCodeRaw: string) {
  const userId = await requireUserId()
  await consumeRateLimit(userId, "invites", 10, 600000)
  let code: string
  try { code = inviteCode(inviteCodeRaw) } catch { return { error: "Codice invito non valido." } }
  const league = await prisma.league.findUnique({
    where: { inviteCode: code }, select: { id: true, name: true, teams: { select: { name: true }, orderBy: { name: "asc" } } },
  })
  if (!league) return { error: "Campionato non trovato o codice errato." }
  return { id: league.id, name: league.name, teams: league.teams.map(t => t.name) }
}

export async function joinLeague(_prevState: unknown, formData: FormData): Promise<{ error: string | null }> {
  const userId = await requireUserId()
  await consumeRateLimit(userId, "invites", 10, 600000)
  const code = inviteCode(formText(formData, "inviteCode", 64))
  const teamName = formText(formData, "teamName", 20)
  const preview = await prisma.league.findUnique({ where: { inviteCode: code }, select: { id: true } })
  if (!preview) return { error: "Campionato non trovato o codice errato." }
  await withLeagueTransaction(preview.id, userId, "join", async (tx, league) => {
    if (league.inviteCode !== code) throw new Error("Codice invito non più valido")
    const team = await tx.team.findFirst({ where: { leagueId: league.id, name: teamName } })
    if (!team) throw new Error("La squadra non appartiene al campionato")
    const existing = await tx.leagueMember.findUnique({ where: { userId_leagueId: { userId, leagueId: league.id } } })
    if (existing && existing.teamName !== teamName) throw new Error("La squadra di appartenenza non può essere cambiata")
    if (!existing) {
      const historical = await tx.ledger.count({ where: { userId, leagueId: league.id } })
      const historicalBets = await tx.bet.count({ where: { userId, match: { matchDay: { leagueId: league.id } } } })
      if (historical || historicalBets) throw new Error("Iscrizione storica senza squadra: contatta l'amministratore")
      await tx.leagueMember.create({ data: { userId, leagueId: league.id, teamName } })
    }
    await tx.league.update({ where: { id: league.id }, data: { users: { connect: { id: userId } } } })
  })
  revalidatePath("/")
  revalidatePath(`/league/${preview.id}`)
  redirect(`/league/${preview.id}`)
}

export async function leaveLeague(leagueId: string) {
  const userId = await requireUserId()
  await withLeagueTransaction(leagueId, userId, "member", async (tx, league) => {
    if (league.adminId === userId) throw new Error("L'amministratore non può abbandonare il proprio campionato")
    // Preserve the fixed team, including after leaving and rejoining.
    await tx.user.update({ where: { id: userId }, data: { leagues: { disconnect: { id: leagueId } } } })
  })
  revalidatePath("/")
  redirect("/")
}

export async function deleteLeague(leagueId: string) {
  const userId = await requireUserId()
  await withLeagueTransaction(leagueId, userId, "admin", async tx => {
    await tx.bet.deleteMany({ where: { match: { matchDay: { leagueId } } } })
    await tx.ledger.deleteMany({ where: { leagueId } }) // remove FK references before matchdays
    await tx.match.deleteMany({ where: { matchDay: { leagueId } } })
    await tx.matchDay.deleteMany({ where: { leagueId } })
    await tx.team.deleteMany({ where: { leagueId } })
    await tx.notification.deleteMany({ where: { leagueId } })
    await tx.auditLog.deleteMany({ where: { leagueId } })
    await tx.leagueMember.deleteMany({ where: { leagueId } })
    await tx.league.delete({ where: { id: leagueId } })
  })
  revalidatePath("/")
  redirect("/")
}

export async function updateCoinName(leagueId: string, formData: FormData) {
  const userId = await requireUserId()
  const coinName = formText(formData, "coinName", 15)
  await withLeagueTransaction(leagueId, userId, "admin", async tx => {
    await tx.league.update({ where: { id: leagueId }, data: { coinName } })
  })
  revalidatePath("/profile")
  revalidatePath(`/league/${leagueId}`)
}

export async function updateLeagueName(leagueId: string, formData: FormData) {
  const userId = await requireUserId()
  const name = formText(formData, "leagueName", 15)
  await withLeagueTransaction(leagueId, userId, "admin", async tx => {
    await tx.league.update({ where: { id: leagueId }, data: { name } })
  })
  revalidatePath("/profile")
  revalidatePath(`/league/${leagueId}`)
}

export async function rotateInviteCode(leagueId: string) {
  const userId = await requireUserId()
  requireId(leagueId)
  await withLeagueTransaction(leagueId, userId, "admin", async tx => {
    await tx.league.update({ where: { id: leagueId }, data: { inviteCode: "VOLLEY-" + randomBytes(16).toString("hex").toUpperCase() } })
    await tx.auditLog.create({ data: { leagueId, userId, action: "Invito rigenerato", details: "Il precedente codice invito non è più valido." } })
  })
  revalidatePath(`/league/${leagueId}`)
}
