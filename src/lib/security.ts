import "server-only"
import { Prisma, type League } from "@prisma/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isDayOpen, type DayWindow } from "@/lib/matchday"

export const MAX_TEAMS = 64

export function requireId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new Error("Identificativo non valido")
  return value
}

export function formText(form: FormData, key: string, maxLength: number, required = true): string {
  const value = form.get(key)
  if (value === null && !required) return ""
  if (typeof value !== "string" || value.length > maxLength) throw new Error(`Campo non valido: ${key}`)
  const trimmed = value.trim()
  if (required && !trimmed) throw new Error(`Campo obbligatorio: ${key}`)
  return trimmed
}

export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")
  const userId = requireId(session.user.id)
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!exists) throw new Error("Sessione non valida. Effettua nuovamente l'accesso.")
  return userId
}

export async function requireLeagueMember(leagueId: string, userId: string) {
  requireId(leagueId)
  const league = await prisma.league.findFirst({
    where: { id: leagueId, users: { some: { id: userId } } },
  })
  if (!league) throw new Error("Forbidden: Non appartieni a questa lega (403)")
  return league
}

// All mutations take this PostgreSQL row lock before reading state. READ COMMITTED
// lets a waiter see the previous writer's committed state when the lock is acquired.
export async function withLeagueTransaction<T>(
  leagueId: string, userId: string, access: "member" | "admin" | "join",
  operation: (tx: Prisma.TransactionClient, league: League) => Promise<T>,
): Promise<T> {
  requireId(leagueId)
  await consumeRateLimit(userId, "league-writes", 60, 60000)
  return prisma.$transaction(async tx => {
    const locked = await tx.league.updateMany({ where: { id: leagueId }, data: { updatedAt: new Date() } })
    if (locked.count !== 1) throw new Error("Campionato non trovato")
    const league = await tx.league.findUnique({ where: { id: leagueId } })
    if (!league) throw new Error("Campionato non trovato")
    if (access === "admin" && league.adminId !== userId) throw new Error("Unauthorized")
    if (access === "member") {
      const member = await tx.user.findFirst({ where: { id: userId, leagues: { some: { id: leagueId } } }, select: { id: true } })
      if (!member) throw new Error("Forbidden: Non appartieni a questa lega (403)")
    }
    return operation(tx, league)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 15000 })
}

export function assertBettingOpen(day: DayWindow) {
  if (!isDayOpen(day)) {
    throw new Error("Le scommesse per questa giornata sono chiuse o la scadenza è superata")
  }
}

// Atomic counters shared by every process; never trust a client-supplied IP header.
export async function consumeRateLimit(userId: string, scope: string, limit: number, windowMs: number) {
  const key = `${scope}:${requireId(userId)}`
  const now = new Date()
  const expiresAt = new Date(now.getTime() + windowMs)
  const rows = await prisma.$queryRaw<{ attempts: number }[]>`
    INSERT INTO "SecurityRateLimit" ("key", "attempts", "expiresAt")
    VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "SecurityRateLimit"."expiresAt" <= ${now}
        THEN 1 ELSE LEAST("SecurityRateLimit"."attempts" + 1, ${limit + 1}) END,
      "expiresAt" = CASE WHEN "SecurityRateLimit"."expiresAt" <= ${now}
        THEN ${expiresAt} ELSE "SecurityRateLimit"."expiresAt" END
    RETURNING "attempts"
  `
  if (!rows[0] || rows[0].attempts > limit) throw new Error("Troppi tentativi. Riprova tra poco.")
}
