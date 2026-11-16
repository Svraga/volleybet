import "server-only"
import { prisma } from "@/lib/prisma"

export async function leagueRankings(leagueId: string, round?: string) {
  const matchDay = { leagueId, status: "SCORED", ...(round ? { id: round } : {}) }
  const [users, pointGroups, coinGroups] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ leagues: { some: { id: leagueId } } }, { ledgers: { some: { leagueId } } }, { bets: { some: { match: { matchDay: { leagueId } } } } }] },
      select: { id: true, name: true, memberships: { where: { leagueId }, select: { teamName: true } } },
    }),
    prisma.bet.groupBy({ by: ["userId", "pointsEarned"], where: { match: { matchDay } }, _count: { _all: true } }),
    prisma.ledger.groupBy({ by: ["userId"], where: { leagueId, ...(round ? { matchDayId: round } : {}) }, _sum: { amount: true } }),
  ])
  const points = new Map<string, { total: number; exact: number; winners: number; count: number }>()
  for (const group of pointGroups) {
    const stats = points.get(group.userId) || { total: 0, exact: 0, winners: 0, count: 0 }
    stats.total += (group.pointsEarned || 0) * group._count._all
    stats.count += group._count._all
    if (group.pointsEarned === 3) stats.exact += group._count._all
    if ((group.pointsEarned || 0) > 0) stats.winners += group._count._all
    points.set(group.userId, stats)
  }
  const coins = new Map(coinGroups.map(group => [group.userId, group._sum.amount || 0]))
  return users.map(user => {
    const p = points.get(user.id) || { total: 0, exact: 0, winners: 0, count: 0 }
    return { user, userTeam: user.memberships[0]?.teamName, totalCoins: coins.get(user.id) || 0, totalPoints: p.total,
      accuracy: p.count ? Math.round(p.exact / p.count * 100) : 0, winnerAccuracy: p.count ? Math.round(p.winners / p.count * 100) : 0 }
  })
}
