import "server-only"
import type { Prisma } from "@prisma/client"
import { assertBettingOpen, formText, requireId, withLeagueTransaction } from "@/lib/security"
import { parseVolleyScore } from "@/lib/volleyball"

export async function saveBets(actorId: string, leagueId: string, dayId: string, form: FormData, proxy = false) {
  requireId(dayId)
  const targetId = proxy ? requireId(formText(form, "userId", 128)) : actorId
  return withLeagueTransaction(leagueId, actorId, proxy ? "admin" : "member", async (tx, league) => {
    const target = await tx.user.findFirst({
      where: { id: targetId, leagues: { some: { id: leagueId } } }, select: { id: true, name: true },
    })
    const member = await tx.leagueMember.findUnique({ where: { userId_leagueId: { userId: targetId, leagueId } } })
    if (!target || !member) throw new Error("Il giocatore non appartiene a questo campionato")
    const day = await tx.matchDay.findFirst({ where: { id: dayId, leagueId }, include: { matches: true } })
    if (!day) throw new Error("Giornata non appartenente a questo campionato")
    assertBettingOpen(day)
    if (proxy && await tx.bet.count({ where: { userId: targetId, match: { matchDayId: dayId } } })) {
      throw new Error("Il giocatore ha già inserito i propri pronostici")
    }
    const bets: { matchId: string; predictedA: number; predictedB: number }[] = []
    for (const match of day.matches) {
      const value = formText(form, `bet_${match.id}`, 3, false)
      if (!value) continue
      if (match.teamA === member.teamName || match.teamB === member.teamName) {
        throw new Error("Non puoi scommettere sulla squadra di appartenenza")
      }
      const score = parseVolleyScore(value)
      if (!score) throw new Error("Punteggio non valido")
      bets.push({ matchId: match.id, predictedA: score.setA, predictedB: score.setB })
    }
    if (!bets.length) throw new Error("Nessun pronostico inserito")
    for (const bet of bets) {
      if (proxy) await tx.bet.create({ data: { userId: targetId, ...bet } })
      else await tx.bet.upsert({
        where: { userId_matchId: { userId: targetId, matchId: bet.matchId } },
        create: { userId: targetId, ...bet }, update: { ...bet, pointsEarned: null },
      })
    }
    await ensureEntryFee(tx, targetId, leagueId, day.id, day.number)
    if (proxy) {
      await tx.auditLog.create({ data: {
        leagueId, userId: actorId, action: "Scommessa Proxy",
        // Do not disclose secret predictions in a log readable by other members.
        details: `Inseriti pronostici per ${target.name || "Utente"}, giornata ${day.number}.`,
      } })
      await tx.notification.create({ data: {
        userId: targetId, leagueId, type: "PROXY_BET",
        message: `L'amministratore ha inserito i tuoi pronostici per la Giornata ${day.number}.`,
      } })
    }
    // Roll back slow requests that crossed the deadline while saving.
    assertBettingOpen(day)
    return league.id
  })
}

async function ensureEntryFee(tx: Prisma.TransactionClient, userId: string, leagueId: string, matchDayId: string, number: number) {
  // Also recognizes historical proxy fees; descriptions are not record identities.
  const existing = await tx.ledger.findFirst({ where: { userId, leagueId, matchDayId, amount: { lt: 0 } } })
  if (!existing) await tx.ledger.create({ data: {
    userId, leagueId, matchDayId, amount: -1, reason: `MatchDay ${number} Entry Fee`,
  } })
}
