import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import Link from "next/link"


export default async function StatsPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ round?: string }> }) {
  const { id } = await params;
  const { round } = await searchParams;
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/")

  const leagueUsers = await prisma.user.findMany({
    where: {
      OR: [
        { leagues: { some: { id } } },
        { ledgers: { some: { leagueId: id } } },
        { bets: { some: { match: { matchDay: { leagueId: id } } } } }
      ]
    },
    include: {
      memberships: { where: { leagueId: id } },
      ledgers: { where: { leagueId: id, ...(round ? { matchDayId: round } : {}) } },
      bets: {
        where: { match: { matchDay: { leagueId: id, status: "SCORED", ...(round ? { id: round } : {}) } } }
      }
    }
  })

  const league = await prisma.league.findUnique({
    where: { id }
  })

  const matchDays = await prisma.matchDay.findMany({
    where: { leagueId: id, status: "SCORED" },
    orderBy: { number: "desc" }
  })

  if (!league) redirect("/")

  // Compute rankings
  const stats = leagueUsers.map(u => {
    const totalCoins = u.ledgers.reduce((acc, l) => acc + l.amount, 0)
    const totalPoints = u.bets.reduce((acc, b) => acc + (b.pointsEarned || 0), 0)
    
    const exactHits = u.bets.filter(b => b.pointsEarned === 3).length
    const winnerHits = u.bets.filter(b => (b.pointsEarned || 0) >= 1).length
    const totalBetsScored = u.bets.length
    const accuracy = totalBetsScored > 0 ? Math.round((exactHits / totalBetsScored) * 100) : 0
    const winnerAccuracy = totalBetsScored > 0 ? Math.round((winnerHits / totalBetsScored) * 100) : 0
    const userTeam = u.memberships[0]?.teamName || league.homeTeam

    return {
      user: u,
      userTeam,
      totalCoins,
      totalPoints,
      exactHits,
      winnerHits,
      totalBetsScored,
      accuracy,
      winnerAccuracy
    }
  })

  const coinRanking = [...stats].sort((a, b) => b.totalCoins - a.totalCoins)
  const pointsRanking = [...stats].sort((a, b) => b.totalPoints - a.totalPoints)

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pb-28 md:pb-12 bg-secondary pt-12">
      <div className="w-full max-w-4xl flex justify-between items-center mb-8 gap-4 flex-wrap">
        <h1 className="text-4xl md:text-5xl font-bold uppercase bg-white border-[4px] border-black shadow-brutal px-4 py-2 inline-block -rotate-1">
          Classifica {round ? ` - Giornata ${matchDays.find(m => m.id === round)?.number || ''}` : ''}
        </h1>
      </div>

      <div className="w-full max-w-4xl flex gap-2 overflow-x-auto pb-4 mb-4">
        <Link href={`/league/${league.id}/stats`}>
          <Button variant={!round ? "primary" : "secondary"} className="whitespace-nowrap">Classifica Generale</Button>
        </Link>
        {matchDays.map(md => (
          <Link key={md.id} href={`/league/${league.id}/stats?round=${md.id}`}>
            <Button variant={round === md.id ? "primary" : "secondary"} className="whitespace-nowrap">
              Giornata {md.number}
            </Button>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Classifica Punti Pronostici</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto max-w-full">
            <ul className="space-y-4">
              {pointsRanking.map((s, idx) => (
                <li key={s.user.id} className="flex flex-col border-b-[3px] border-black pb-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <span className="text-2xl font-bold w-8 text-gray-400 shrink-0">{idx + 1}°</span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-lg truncate min-w-0">{s.user.name}</span>
                        <span className="text-xs font-semibold text-gray-500 uppercase truncate">{s.userTeam}</span>
                      </div>
                    </div>
                    <span className="text-2xl font-bold shrink-0">{s.totalPoints} pt</span>
                  </div>
                  {!round && (
                    <div className="pl-12 text-sm font-bold text-gray-500 mt-1">
                      <p>Vincenti: {s.winnerAccuracy}%</p>
                      <p>Esatti: {s.accuracy}%</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {!round && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Classifica {league.coinName}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto max-w-full">
              <ul className="space-y-4">
                {coinRanking.map((s, idx) => (
                  <li key={s.user.id} className="flex justify-between items-center border-b-[3px] border-black pb-2">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <span className="text-2xl font-bold w-8 shrink-0">{idx + 1}°</span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-lg truncate min-w-0">{s.user.name}</span>
                        <span className="text-xs font-semibold text-gray-500 uppercase truncate">{s.userTeam}</span>
                      </div>
                    </div>
                    <span className={`text-2xl font-bold shrink-0 ${s.totalCoins >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {s.totalCoins > 0 ? '+' : ''}{Math.floor(s.totalCoins)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
