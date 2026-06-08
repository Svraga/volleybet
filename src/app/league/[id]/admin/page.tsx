import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { createMatchDay } from "@/actions/matchday"
import AdminMatchdayPanel from "@/components/AdminMatchdayPanel"
import DeleteMatchDayButton from "@/components/DeleteMatchDayButton"
import AdminHeader from "@/components/AdminHeader"
import AdminPageTour from "@/components/AdminPageTour"
import SubmitButton from "@/components/SubmitButton"

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
    where: {
      OR: [
        { leagues: { some: { id: league.id } } },
        { ledgers: { some: { leagueId: league.id } } },
        { bets: { some: { match: { matchDay: { leagueId: league.id } } } } }
      ]
    },
    include: { bets: true }
  })

  // Sort: OPEN first, then SCORED, then by number descending
  matchDays.sort((a, b) => {
    if (a.status === "OPEN" && b.status !== "OPEN") return -1
    if (a.status !== "OPEN" && b.status === "OPEN") return 1
    return b.number - a.number
  })

  // Prebind actions
  const boundCreateMatchDay = createMatchDay.bind(null, league.id)

  const hasEmptyMatchDays = matchDays.some(md => md.matches.length === 0)

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pb-28 md:pb-12 bg-secondary pt-12">
      <AdminPageTour hasMatchdays={matchDays.length > 0} />
      <div className="w-full max-w-4xl mb-8">
        <AdminHeader leagueId={league.id} hasEmptyMatchDays={hasEmptyMatchDays} />
      </div>

      <div className="grid md:grid-cols-3 gap-8 w-full max-w-4xl">
        <div id="tour-admin-new-matchday" className="md:col-span-1 space-y-8">
          <Card className="bg-white overflow-hidden border-[3px] border-black">
            <details className="group">
              <summary className="list-none cursor-pointer flex justify-between items-center bg-primary text-black font-bold p-4 hover:bg-yellow-400 transition-colors">
                <span className="text-xl">➕ Nuova Giornata</span>
                <span className="transition group-open:rotate-180">▼</span>
              </summary>
              <div className="p-4 border-t-[3px] border-black bg-white">
                <form action={boundCreateMatchDay} className="space-y-4">
                  <div className="space-y-2">
                    <label className="font-bold">Numero Giornata</label>
                    <Input type="number" name="number" defaultValue={matchDays.length + 1} required />
                  </div>
                  <div className="space-y-2">
                    <label className="font-bold">Scadenza (Deadline)</label>
                    <Input type="datetime-local" name="deadline" required />
                  </div>
                  <SubmitButton variant="primary" className="w-full mt-4 h-12" defaultText="Crea Giornata" loadingText="CREAZIONE..." />
                </form>
              </div>
            </details>
          </Card>
        </div>

        <div id="tour-admin-matchday-list" className="md:col-span-2 space-y-8">
          {matchDays.map(md => (
            <Card key={md.id} className="bg-white overflow-hidden">
              <details className="group" open={md.status === 'OPEN'}>
                <summary className="list-none cursor-pointer">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-100 transition-colors p-6 border-b-[3px] border-black">
                    <div className="flex items-center gap-4">
                      <CardTitle>Giornata {md.number}</CardTitle>
                      <span className={`font-bold px-3 py-1 border-[2px] border-black text-sm ${md.status === 'OPEN' ? 'bg-green-400' : 'bg-gray-300'}`}>
                        {md.status === 'SCORED' ? 'COMPLETATA' : md.status}
                      </span>
                      <span className="transition group-open:rotate-180 font-bold text-lg">▼</span>
                    </div>
                  </div>
                </summary>
                <CardContent className="space-y-6 pt-6">
                  <AdminMatchdayPanel 
                    leagueId={league.id} 
                    matchDay={md} 
                    teams={teams}
                    hasOddTeams={league.hasOddTeams}
                    users={users.map(u => ({ ...u, bets: u.bets.filter(b => md.matches.some(m => m.id === b.matchId)) }))}
                  />
                  <div className="flex justify-center pt-4 border-t-[4px] border-black border-dashed mt-4">
                    <DeleteMatchDayButton leagueId={league.id} matchDayId={md.id} />
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
