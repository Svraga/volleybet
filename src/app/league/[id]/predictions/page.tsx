import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireLeagueMember } from "@/lib/security"
import { isDayClosed } from "@/lib/matchday"
import PredictionsBoard from "@/components/PredictionsBoard"
import MatchdayRefresh from "@/components/MatchdayRefresh"

export default async function PredictionsPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ round?: string }>
}) {
  const { id } = await params
  const { round } = await searchParams
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/")
  const league = await requireLeagueMember(id, session.user.id)
  // The database predicate excludes secret predictions before they are fetched.
  const closedWhere = { leagueId: league.id, OR: [{ status: { in: ["CLOSED", "SCORED"] } }, { deadline: { lte: new Date() } }] }
  const days = await prisma.matchDay.findMany({
    where: closedWhere, orderBy: { number: "desc" },
    select: { id: true, number: true, status: true, deadline: true },
  })
  const selected = round ? days.find(day => day.id === round) : days[0]
  const day = selected ? await prisma.matchDay.findFirst({
    where: { ...closedWhere, id: selected.id },
    select: {
      id: true, number: true, status: true, deadline: true,
      matches: { orderBy: { id: "asc" }, select: {
        id: true, teamA: true, teamB: true, resultA: true, resultB: true,
        bets: { orderBy: { user: { name: "asc" } }, select: {
          id: true, userId: true, predictedA: true, predictedB: true, pointsEarned: true,
          user: { select: { name: true } },
        } },
      } },
    },
  }) : null
  const visibleDay = day && isDayClosed(day) ? day : null
  return <main className="min-h-screen bg-primary px-4 pb-28 pt-8 sm:px-6 md:pb-12">
    <div className="mx-auto max-w-4xl space-y-6">
      <MatchdayRefresh at={[]} poll={visibleDay?.status !== "SCORED"} />
      <div>
        <h1 className="inline-block -rotate-1 border-[4px] border-black bg-white px-4 py-2 text-2xl font-black uppercase shadow-brutal sm:text-3xl">Pronostici della lega</h1>
        <p className="mt-4 text-sm font-bold">Tutte le giocate, visibili dopo la chiusura delle scommesse.</p>
      </div>
      {days.length > 0 && <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 pb-2 text-xs font-black uppercase sm:text-sm">Giornata</span>
        <nav aria-label="Scegli giornata" className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-2">
          {days.map(d => <Link key={d.id} href={`/league/${league.id}/predictions?round=${d.id}`} aria-label={`Giornata ${d.number}`} aria-current={d.id === visibleDay?.id ? "page" : undefined} className={`flex h-10 min-w-10 shrink-0 items-center justify-center border-[3px] border-black px-2 text-sm font-black shadow-brutal-sm ${d.id === visibleDay?.id ? "bg-secondary" : "bg-white hover:bg-yellow-100"}`}>{d.number}</Link>)}
        </nav>
      </div>}
      {visibleDay ? <>
        <PredictionsBoard key={visibleDay.id} scored={visibleDay.status === "SCORED"} matches={visibleDay.matches.map(m => ({
          id: m.id, teamA: m.teamA, teamB: m.teamB, resultA: m.resultA, resultB: m.resultB,
          bets: m.bets.map(b => ({ id: b.id, userId: b.userId, name: b.user.name || "Giocatore", predictedA: b.predictedA, predictedB: b.predictedB, points: visibleDay.status === "SCORED" ? b.pointsEarned : null })),
        }))} />
      </> : <div className="border-[3px] border-black bg-white p-6 font-bold shadow-brutal">{round ? "Questa giornata non è disponibile. I pronostici restano riservati fino alla chiusura." : "Non ci sono ancora giornate chiuse. Torna qui dopo la prima scadenza per confrontare i pronostici."}</div>}
    </div>
  </main>
}
