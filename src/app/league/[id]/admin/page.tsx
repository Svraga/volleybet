import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardTitle } from "@/components/ui/Card"
import { createMatchDayFromForm } from "@/actions/matchday"
import { isDayClosed, isDayScheduled } from "@/lib/matchday"
import MatchdayDateForm from "@/components/MatchdayDateForm"
import MatchdayRefresh from "@/components/MatchdayRefresh"
import AdminMatchdayPanel from "@/components/AdminMatchdayPanel"
import DeleteMatchDayButton from "@/components/DeleteMatchDayButton"
import AdminHeader from "@/components/AdminHeader"
import AdminPageTour from "@/components/AdminPageTour"

export default async function AdminPanelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/")

  const league = await prisma.league.findUnique({
    where: { id }
  })

  if (!league || league.adminId !== session.user.id) {
    redirect(`/league/${id}`)
  }

  const matchDays = await prisma.matchDay.findMany({
    where: { leagueId: league.id },
    include: { matches: true }
  })
  
  const teams = await prisma.team.findMany({
    where: { leagueId: league.id },
    orderBy: { name: "asc" }
  })

  const users = await prisma.user.findMany({
    where: { leagues: { some: { id: league.id } } },
    select: {
      id: true, name: true,
      bets: { where: { match: { matchDay: { leagueId: league.id } } }, select: { matchId: true } },
      memberships: { where: { leagueId: league.id }, select: { teamName: true } }
    }
  })

  // Sort: OPEN first, then SCORED, then by number descending
  matchDays.sort((a, b) => {
    if (a.status === "OPEN" && b.status !== "OPEN") return -1
    if (a.status !== "OPEN" && b.status === "OPEN") return 1
    return b.number - a.number
  })

  // Prebind actions
  const boundCreateMatchDay = createMatchDayFromForm.bind(null, league.id)

  const hasEmptyMatchDays = matchDays.some(md => md.matches.length === 0)

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pb-28 md:pb-12 bg-secondary pt-12">
      <MatchdayRefresh at={matchDays.flatMap(md => [md.deadline.getTime(), ...(md.opensAt ? [md.opensAt.getTime()] : [])])} />
      <AdminPageTour hasMatchdays={matchDays.length > 0} />
      <div className="w-full max-w-4xl mb-8">
        <AdminHeader leagueId={league.id} leagueName={league.name} coinName={league.coinName} hasEmptyMatchDays={hasEmptyMatchDays} />
      </div>

      <div className="grid md:grid-cols-3 gap-8 w-full max-w-4xl">
        <div id="tour-admin-new-matchday" className="md:col-span-1 space-y-8 min-w-0">
          <Card className="bg-white overflow-hidden border-[3px] border-black">
            <details className="group">
              <summary className="list-none cursor-pointer flex justify-between items-center bg-primary text-black font-bold p-4 hover:bg-yellow-400 transition-colors">
                <span className="text-xl">➕ Nuova Giornata</span>
                <span className="transition group-open:rotate-180">▼</span>
              </summary>
              <div className="p-4 border-t-[3px] border-black bg-white">
                <MatchdayDateForm action={boundCreateMatchDay} number={Math.max(0, ...matchDays.map(md => md.number)) + 1} />
              </div>
            </details>
          </Card>
        </div>

        <div id="tour-admin-matchday-list" className="md:col-span-2 space-y-8 min-w-0">
          {matchDays.map(md => (
            <Card key={md.id} className="bg-white overflow-hidden">
              <details className="group" open={md.status === 'OPEN'}>
                <summary className="list-none cursor-pointer">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-100 transition-colors p-6 border-b-[3px] border-black">
                    <div className="flex items-center gap-4">
                      <CardTitle>Giornata {md.number}</CardTitle>
                      <span className={`font-bold px-3 py-1 border-[2px] border-black text-sm ${md.status === 'OPEN' ? 'bg-green-400' : 'bg-gray-300'}`}>
                        {md.status === 'SCORED' ? 'COMPLETATA' : isDayClosed(md) ? 'CHIUSA' : isDayScheduled(md) ? 'PROGRAMMATA' : 'APERTA'}
                      </span>
                      <span className="transition group-open:rotate-180 font-bold text-lg">▼</span>
                    </div>
                  </div>
                </summary>
                <CardContent className="space-y-6 pt-3 mt-1">
                  <AdminMatchdayPanel 
                    leagueId={league.id} 
                    homeTeam={league.homeTeam}
                    matchDay={md}
                    initiallyClosed={md.status !== "OPEN" || new Date().getTime() >= md.deadline.getTime()}
                    initiallyScheduled={isDayScheduled(md)}
                    teams={teams}
                    hasOddTeams={league.hasOddTeams}
                    users={users.map(u => ({ 
                      id: u.id,
                      name: u.name,
                      teamName: u.memberships[0]?.teamName || "",
                      hasBets: u.bets.some(b => md.matches.some(m => m.id === b.matchId))
                    }))}
                  />
                  <div className="flex justify-center pt-4 border-t-[4px] border-black border-dashed mt-4">
                    {md.status === "OPEN" && new Date().getTime() < md.deadline.getTime() && <DeleteMatchDayButton leagueId={league.id} matchDayId={md.id} />}
                  </div>
                </CardContent>
              </details>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
