import { pageNumber } from "@/lib/pagination"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireLeagueMember } from "@/lib/security"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { leagueRankings } from "@/lib/rankings"


export default async function StatsPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ round?: string; page?: string }> }) {
  const { id } = await params;
  const { round, page: rawPage } = await searchParams;
  const page = pageNumber(rawPage)
  const offset = (page - 1) * 50
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/")
  const league = await requireLeagueMember(id, session.user.id)

  const matchDays = await prisma.matchDay.findMany({
    where: { leagueId: id, status: "SCORED" },
    orderBy: { number: "desc" }
  })

  if (!league) redirect("/")

  const stats = await leagueRankings(id, round)

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

      <nav className="mb-4 flex w-full max-w-4xl justify-between font-bold">{page > 1 && <Link href={`?${round ? `round=${round}&` : ""}page=${page - 1}`}>← Precedenti</Link>}{stats.length > offset + 50 && <Link href={`?${round ? `round=${round}&` : ""}page=${page + 1}`}>Successive →</Link>}</nav>
      <div className={`grid ${round ? "" : "md:grid-cols-2"} gap-8 w-full max-w-4xl`}>
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Classifica Punti Pronostici</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto max-w-full">
            <ul className="space-y-4">
              {pointsRanking.slice(offset, offset + 50).map((s, idx) => (
                <li key={s.user.id} className="flex flex-col border-b-[3px] border-black pb-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <span className="text-2xl font-bold w-8 text-gray-400 shrink-0">{idx + 1}°</span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-lg truncate min-w-0">{s.user.name}</span>
                        <span className="text-xs font-semibold text-gray-500 uppercase truncate">{s.userTeam || league.homeTeam}</span>
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

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>{round ? "Resoconto" : "Classifica"} {league.coinName}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto max-w-full">
              {round && <p className="mb-4 text-sm font-bold text-gray-600">Saldo netto della giornata: premi e rimborsi meno quota di partecipazione.</p>}
              <ul className="space-y-4">
                {coinRanking.slice(offset, offset + 50).map((s, idx) => (
                  <li key={s.user.id} className="flex justify-between items-center border-b-[3px] border-black pb-2">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <span className="text-2xl font-bold w-8 shrink-0">{idx + 1}°</span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-lg truncate min-w-0">{s.user.name}</span>
                        <span className="text-xs font-semibold text-gray-500 uppercase truncate">{s.userTeam || league.homeTeam}</span>
                      </div>
                    </div>
                    <span className={`text-2xl font-bold shrink-0 ${s.totalCoins >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {s.totalCoins > 0 ? '+' : ''}{s.totalCoins.toLocaleString("it-IT", { maximumFractionDigits: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
      </div>
    </main>
  )
}
