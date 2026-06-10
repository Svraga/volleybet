import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { leaveLeague } from "@/actions/league"
import GuidedTour from "@/components/GuidedTour"
import AdminButtonClient from "@/components/AdminButtonClient"
import CopyInviteButton from "@/components/CopyInviteButton"
import NotificationBell from "@/components/NotificationBell"
import { ShieldCheck, Medal, TriangleAlert, CircleDollarSign } from "lucide-react"

export default async function LeagueDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      ledgers: { where: { leagueId: id } },
      notifications: { 
        where: { leagueId: id },
        orderBy: { createdAt: "desc" },
        take: 10
      }
    }
  })

  const league = await prisma.league.findUnique({
    where: { id },
    include: { users: { where: { id: session.user.id } } }
  })

  if (!user || !league || league.users.length === 0) {
    redirect("/")
  }

  const isAdmin = league.adminId === user.id
  
  // Calculate total coins from ledger
  const currentCoins = user.ledgers.reduce((acc, ledger) => acc + ledger.amount, 0)

  // Fetch all matchdays
  const matchDays = await prisma.matchDay.findMany({
    where: { leagueId: league.id },
    orderBy: { number: "asc" }
  })

  const openMatchDays = matchDays.filter(md => md.status === "OPEN" && new Date() <= new Date(md.deadline))

  // Fetch top 3 users by points
  const leagueUsers = await prisma.user.findMany({
    where: { leagues: { some: { id: league.id } } },
    include: {
      bets: {
        where: { match: { matchDay: { status: "SCORED" } } }
      }
    }
  })

  const top3 = leagueUsers.map(u => ({
    user: u,
    points: u.bets.reduce((acc, b) => acc + (b.pointsEarned || 0), 0)
  })).sort((a, b) => b.points - a.points).slice(0, 3)

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pb-28 md:pb-12 bg-primary pt-12 relative">
      <NotificationBell leagueId={league.id} notifications={user.notifications} />
      <GuidedTour isAdmin={isAdmin} />
      <div id="tour-welcome" className="w-full max-w-4xl flex justify-between items-center mb-8 gap-4 flex-wrap pr-12">
        <h1 className="text-xl md:text-2xl font-bold uppercase bg-white border-[4px] border-black shadow-brutal px-4 py-2 inline-block -rotate-1 truncate max-w-full">
          {league.name}
        </h1>
        
        <div className="flex gap-4">
          {isAdmin && (
            <AdminButtonClient leagueId={league.id} />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-4xl">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div id="tour-coin" className="flex-1 bg-white border-[3px] border-black shadow-brutal px-4 py-2 flex items-center justify-start gap-3">
            <span className="font-bold text-gray-500 uppercase text-xs sm:text-sm">{league.coinName}:</span>
            <span className="text-xl sm:text-2xl font-bold flex items-center gap-1"><CircleDollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />{Math.floor(currentCoins)}</span>
          </div>
        </div>

        <div className="w-full space-y-8">
          <Card id="tour-open-matchdays" className="bg-secondary border-[3px] border-black shadow-brutal">
            <CardHeader>
              <CardTitle className="text-2xl">Scommesse Aperte</CardTitle>
            </CardHeader>
            <CardContent>
              {openMatchDays.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-lg font-bold">Non ci sono scommesse aperte.</p>
                  {isAdmin && <p className="mt-2 font-bold text-sm">Vai nel Pannello Admin per creare una nuova giornata.</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  {openMatchDays.map(md => (
                    <div key={md.id} className="bg-white border-[3px] border-black p-3 sm:p-4 flex flex-row justify-between items-center gap-2 sm:gap-4 transition-all shadow-brutal hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-brutal-sm">
                      <div>
                        <h4 className="text-lg sm:text-xl font-bold leading-none">Giornata {md.number}</h4>
                        <div className="mt-2 inline-flex flex-col bg-yellow-300 border-[2px] border-black px-1 sm:px-2 py-1 -rotate-2 shadow-[2px_2px_0_rgba(0,0,0,1)] text-[10px] sm:text-xs font-black uppercase">
                          <span className="flex items-center gap-1"><TriangleAlert className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={2.5} /> Scadenza:</span>
                          <span>{new Date(md.deadline).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</span>
                        </div>
                      </div>
                      <Link href={`/league/${league.id}/matchday/${md.id}`} className="shrink-0">
                        <Button variant="primary" className="text-sm sm:text-lg uppercase font-black px-3 sm:px-6">SCOMMETTI</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top 3 Punti */}
          <Card className="bg-white border-[3px] border-black shadow-brutal">
            <CardHeader className="border-b-[3px] border-black bg-yellow-200">
              <CardTitle className="text-xl flex justify-between items-center">
                Top 3
                <Link href={`/league/${league.id}/stats`}>
                  <Button variant="primary" className="h-8 px-2 text-xs font-black uppercase">
                    Classifica Completa →
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {top3.length === 0 ? (
                <p className="font-bold text-gray-500 text-center">Ancora nessun punteggio.</p>
              ) : (
                <ul className="space-y-3">
                  {top3.map((s, idx) => (
                    <li key={s.user.id} className="flex justify-between items-center font-bold">
                      <div className="flex items-center gap-3">
                        <span className="w-8 flex justify-center">
                          {idx === 0 ? <Medal className="w-6 h-6 text-yellow-500 fill-yellow-500" /> : 
                           idx === 1 ? <Medal className="w-6 h-6 text-gray-400 fill-gray-400" /> : 
                           <Medal className="w-6 h-6 text-amber-700 fill-amber-700" />}
                        </span>
                        <span className="text-lg truncate max-w-[150px] sm:max-w-[200px]">{s.user.name}</span>
                      </div>
                      <span className="text-xl">{s.points} pt</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Invito - Spostato in fondo */}
          <div id="tour-invite" className="bg-white border-[3px] border-black shadow-brutal px-4 py-4 flex flex-col items-center justify-center text-center">
            <span className="font-bold text-gray-500 uppercase text-xs mb-1">Codice Invito Lega</span>
            <span className="text-3xl font-black tracking-widest">{league.inviteCode}</span>
            <CopyInviteButton code={league.inviteCode} />
          </div>
        </div>
      </div>
    </main>
  )
}
