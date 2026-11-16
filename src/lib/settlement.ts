import "server-only"
import type { Prisma } from "@prisma/client"
import { randomBytes } from "node:crypto"
import { isValidVolleyScore, parseVolleyScore } from "@/lib/volleyball"
import { formText } from "@/lib/security"
import { predictionPoints } from "@/lib/scoring"
import { splitWholeCoins } from "@/lib/payouts"
import { recordAudit } from "@/lib/audit"

// Shared settlement for authenticated admin actions and the maintenance command.
// The caller must hold the league row lock for the entire transaction.
export async function settleMatchDay(tx: Prisma.TransactionClient, leagueId: string, matchDayId: string, userId: string, formData: FormData, { notify = true } = {}) {
  const matchDay = await tx.matchDay.findUnique({
    where: { id: matchDayId },
    include: { matches: { include: { bets: true } } }
  })

  if (!matchDay || matchDay.leagueId !== leagueId) {
    throw new Error("Matchday non trovato o non appartenente a questo campionato")
  }

  if (Date.now() < matchDay.deadline.getTime()) throw new Error("Attendi la scadenza prima di inserire i risultati")
  if (!matchDay.matches.length) throw new Error("La giornata non contiene partite")

  // Parse and validate match results
  const matchesToUpdate: { id: string; resultA: number; resultB: number }[] = []
  for (const m of matchDay.matches) {
    const resultVal = formText(formData, `result_${m.id}`, 3, false)
    if (!resultVal) {
      throw new Error("Devi inserire tutti i risultati prima di procedere")
    }
    if (!isValidVolleyScore(resultVal)) {
      throw new Error(`Risultato non valido: ${resultVal}. Punteggi ammessi: 3-0, 3-1, 3-2, 2-3, 1-3, 0-3`)
    }
    const parsed = parseVolleyScore(resultVal)
    if (!parsed) {
      throw new Error(`Errore nel parsing del punteggio: ${resultVal}`)
    }
    matchesToUpdate.push({
      id: m.id,
      resultA: parsed.setA,
      resultB: parsed.setB
    })
  }

  const isRescore = matchDay.status === "SCORED"
  const coinDrawSeed = matchDay.coinDrawSeed || randomBytes(32).toString("hex")
  const draws: { rank: string; recipients: string[] }[] = []
  const extraCoinRecipients = new Set<string>()

  // 1. Clean up old payouts and refunds if re-scoring
  const previousCredits = await tx.ledger.findMany({ where: { leagueId, matchDayId: matchDay.id, amount: { gt: 0 } } })
  const replaceable = previousCredits.filter(l => l.kind === "PAYOUT" || l.kind === "REFUND" ||
    (!l.kind || l.kind === "LEGACY") && /^(Payout MatchDay |Refund \()/.test(l.reason || ""))
  for (let start = 0; start < replaceable.length; start += 1000) {
    await tx.ledger.deleteMany({ where: { leagueId, matchDayId: matchDay.id, id: { in: replaceable.slice(start, start + 1000).map(l => l.id) } } })
  }

  // 2. Update matches and bets
  const userPoints: Record<string, number> = {} // userId -> points
  const betIdsByPoints = new Map<number, string[]>([[0, []], [1, []], [3, []]])
  const credits: Prisma.LedgerCreateManyInput[] = []

  for (const matchUpdate of matchesToUpdate) {
    await tx.match.update({
      where: { id: matchUpdate.id },
      data: { resultA: matchUpdate.resultA, resultB: matchUpdate.resultB }
    })

    const match = matchDay.matches.find(m => m.id === matchUpdate.id)!

    for (const bet of match.bets) {
      const points = predictionPoints(bet.predictedA, bet.predictedB, matchUpdate.resultA, matchUpdate.resultB)

      betIdsByPoints.get(points)!.push(bet.id)

      userPoints[bet.userId] = (userPoints[bet.userId] || 0) + points
    }
  }

  // Batch equal scores instead of making one database round trip per prediction.
  // Chunk IDs to keep large days below the database parameter limit.
  for (const [pointsEarned, ids] of betIdsByPoints) {
    for (let start = 0; start < ids.length; start += 1000) {
      await tx.bet.updateMany({
        where: { id: { in: ids.slice(start, start + 1000) } },
        data: { pointsEarned }
      })
    }
  }

  // 3. Calculate total pool from entry fee ledgers
  const betLedgers = await tx.ledger.findMany({
    where: { leagueId, matchDayId: matchDay.id, amount: { lt: 0 } }
  })

  const feesByUser: Record<string, number> = {}
  for (const fee of betLedgers) {
    if (fee.kind === "ADJUSTMENT") continue
    if (!Number.isSafeInteger(fee.amount)) throw new Error("Le quote devono essere espresse in coin interi")
    feesByUser[fee.userId] = (feesByUser[fee.userId] || 0) + Math.abs(fee.amount)
  }
  // Refund legacy fees without predictions instead of donating them to other players.
  for (const [uid, spent] of Object.entries(feesByUser)) {
    if (!(uid in userPoints)) credits.push({
      userId: uid, leagueId, matchDayId: matchDay.id, amount: spent, kind: "REFUND", reason: "Refund (No predictions)"
    })
  }
  const totalPool = Object.entries(feesByUser).reduce((sum, [uid, spent]) => uid in userPoints ? sum + spent : sum, 0)

  if (totalPool > 0) {
    const usersWithBets = Object.keys(userPoints).filter(uid => feesByUser[uid] > 0)
    const allZeros = usersWithBets.length > 0 && usersWithBets.every(uid => userPoints[uid] === 0)

    if (allZeros) {
      // Refund everyone exactly what they spent
      for (const uid of usersWithBets) {
        const spent = feesByUser[uid]
        if (spent > 0) {
          credits.push({
            userId: uid,
            leagueId,
            matchDayId: matchDay.id,
            amount: spent,
            kind: "REFUND",
            reason: "Refund (Everyone scored 0)"
          })
        }
      }
    } else if (usersWithBets.length > 0) {
      // Group by points descending
      const sortedScores = Array.from(new Set(usersWithBets.map(uid => userPoints[uid]))).sort((a, b) => b - a)
      const rankDistribution: Record<string, number> = {}

      const firstScore = sortedScores[0]
      const firstPlaceUsers = usersWithBets.filter(u => userPoints[u] === firstScore)

      if (firstPlaceUsers.length === 1) {
        // Exactly 1 winner
        const u1 = firstPlaceUsers[0]
        let totalSecondPlacePayout = 0

        if (sortedScores.length > 1 && totalPool >= 3) {
          // Only reward 2nd place if pool >= 3 to protect winner's profit
          const secondScore = sortedScores[1]
          const secondPlaceUsers = usersWithBets.filter(u => userPoints[u] === secondScore)

          // Cap total second place payout so winner always gets at least half the pool and at least 2 coins
          const maxSecondPlacePool = Math.min(secondPlaceUsers.length, Math.floor((totalPool - 1) / 2))

          if (maxSecondPlacePool > 0) {
            const split = splitWholeCoins(maxSecondPlacePool, secondPlaceUsers, coinDrawSeed, "second")
            Object.assign(rankDistribution, split.amounts)
            totalSecondPlacePayout = maxSecondPlacePool
            if (split.extraCoinUserIds.length) {
              draws.push({ rank: "secondi", recipients: split.extraCoinUserIds })
              for (const id of split.extraCoinUserIds) extraCoinRecipients.add(id)
            }
          }
        }

        rankDistribution[u1] = Math.max(1, totalPool - totalSecondPlacePayout)
      } else {
        const split = splitWholeCoins(totalPool, firstPlaceUsers, coinDrawSeed, "first")
        Object.assign(rankDistribution, split.amounts)
        if (split.extraCoinUserIds.length) {
          draws.push({ rank: "primi", recipients: split.extraCoinUserIds })
          for (const id of split.extraCoinUserIds) extraCoinRecipients.add(id)
        }
      }

      // Apply payouts
      for (const [uid, coins] of Object.entries(rankDistribution)) {
        if (coins > 0) {
          credits.push({
            userId: uid,
            leagueId,
            matchDayId: matchDay.id,
            amount: coins,
              kind: "PAYOUT",
            reason: `Payout MatchDay ${matchDay.number}${extraCoinRecipients.has(uid) ? " (Sorteggio resto +1)" : ""}`
          })
        }
      }
    }
  }

  // Keep payouts and refunds atomic with results, including when re-scoring.
  for (let start = 0; start < credits.length; start += 1000) {
    await tx.ledger.createMany({ data: credits.slice(start, start + 1000) })
  }

  // Set MatchDay status to SCORED
  await tx.matchDay.update({
    where: { id: matchDay.id },
    data: { status: "SCORED", coinDrawSeed }
  })

  // Log the action
  await recordAudit(tx, {
      leagueId,
      userId: userId,
      action: isRescore ? "Risultati Modificati" : "Risultati Inseriti",
      payload: {
        before: { results: matchDay.matches.map(m => ({ id: m.id, resultA: m.resultA ?? null, resultB: m.resultB ?? null })), credits: previousCredits.map(l => ({ userId: l.userId, amount: l.amount, kind: l.kind || "LEGACY", reason: l.reason || "" })) },
        after: { results: matchesToUpdate, credits: [...previousCredits.filter(l => !replaceable.includes(l)), ...credits].map(l => ({ userId: l.userId, amount: l.amount, kind: l.kind || "LEGACY", reason: l.reason })) },
      },
      details: isRescore
        ? `Risultati e classifiche ricalcolati per la Giornata ${matchDay.number}`
        : `Risultati inseriti e premi distribuiti per la Giornata ${matchDay.number}`
  })

  const users = await tx.user.findMany({ where: { leagues: { some: { id: leagueId } } }, select: { id: true, name: true } })
  if (draws.length) {
    const names = new Map(users.map(u => [u.id, u.name || u.id]))
    await recordAudit(tx, { data: {
      leagueId, userId, action: "Sorteggio Coin",
      details: `Giornata ${matchDay.number}: coin extra ai ${draws.map(draw => `${draw.rank}: ${draw.recipients.map(id => names.get(id) || id).join(", ")}`).join("; ")}. Seed: ${coinDrawSeed}. Il ricalcolo riutilizza lo stesso sorteggio.`,
    } })
  }
  if (notify) await tx.notification.createMany({
    data: users.map(u => ({
      userId: u.id,
      leagueId,
      message: isRescore
        ? `Attenzione: I risultati e le classifiche della Giornata ${matchDay.number} sono stati aggiornati dall'amministratore!`
        : `Sono stati pubblicati i risultati e le classifiche della Giornata ${matchDay.number}!`,
      type: "SCORED"
    }))
  })
}
