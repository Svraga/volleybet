import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { leaveLeague } from "@/actions/league"
import RevokeSessionsButton from "@/components/RevokeSessionsButton"
import { CircleDollarSign } from "lucide-react"
import DeleteLeagueForm from "@/components/DeleteLeagueForm"
import BottomNav from "@/components/BottomNav"
import UpdateNicknameForm from "@/components/UpdateNicknameForm"
import { cookies } from "next/headers"

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      leagues: true,
      memberships: true,
    }
  })

  if (!user) redirect("/")

  const adminEmail = "svraga.channel.bs@gmail.com"

  const cookieStore = await cookies()
  const lastLeagueId = cookieStore.get("lastLeagueId")?.value
  const activeLeague = user.leagues.find(l => l.id === lastLeagueId) || user.leagues[0]

  const [points, exactHits, winnerHits, totalBets, balance] = await Promise.all([
    prisma.bet.aggregate({ where: { userId: user.id, pointsEarned: { not: null } }, _sum: { pointsEarned: true } }),
    prisma.bet.count({ where: { userId: user.id, pointsEarned: 3 } }),
    prisma.bet.count({ where: { userId: user.id, pointsEarned: { gt: 0 } } }),
    prisma.bet.count({ where: { userId: user.id, pointsEarned: { not: null } } }),
    prisma.ledger.aggregate({ where: { userId: user.id }, _sum: { amount: true } }),
  ])
  const totalPoints = points._sum.pointsEarned || 0
  const globalCoins = balance._sum.amount || 0
  const accuracy = totalBets ? Math.round(exactHits / totalBets * 100) : 0
  const winnerAccuracy = totalBets ? Math.round(winnerHits / totalBets * 100) : 0

  return (
    <div className="pb-20 md:pb-0 min-h-screen bg-primary w-full overflow-x-hidden">
      <main className="flex flex-col items-center p-6 pt-12 w-full max-w-2xl mx-auto">
        <div className="w-full mb-8 flex justify-center items-center">
          <h1 className="text-4xl font-bold uppercase bg-white border-[4px] border-black shadow-brutal px-4 py-2 inline-block -rotate-1">
            Il tuo Profilo
          </h1>
        </div>

        <div className="grid gap-8 w-full">
          <Card className="bg-white border-[3px] border-black shadow-brutal">
            <CardHeader>
              <CardTitle>Le tue Statistiche Globali</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 text-xl">
                <li className="flex justify-between border-b-[3px] border-black pb-2">
                  <span className="font-bold text-gray-600">Punti Totali</span>
                  <span className="font-bold">{totalPoints} pt</span>
                </li>
                <li className="flex justify-between border-b-[3px] border-black pb-2">
                  <span className="font-bold text-gray-600">Saldo Globale</span>
                  <span className="font-bold flex items-center gap-1">
                    <CircleDollarSign className="w-5 h-5 text-yellow-500" />
                    {Math.floor(globalCoins)}
                  </span>
                </li>
                <li className="flex justify-between border-b-[3px] border-black pb-2">
                  <span className="font-bold text-gray-600">Risultati Esatti</span>
                  <span className="font-bold">{exactHits}/{totalBets} ({accuracy}%)</span>
                </li>
                <li className="flex justify-between border-b-[3px] border-black pb-2">
                  <span className="font-bold text-gray-600">Partite Prese</span>
                  <span className="font-bold">{winnerHits}/{totalBets} ({winnerAccuracy}%)</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-white border-[3px] border-black shadow-brutal">
            <CardHeader>
              <CardTitle>Impostazioni Profilo</CardTitle>
            </CardHeader>
            <CardContent>
              <UpdateNicknameForm defaultName={user.name || ""} />
              <RevokeSessionsButton />
            </CardContent>
          </Card>

          <Card className="bg-white border-[3px] border-black shadow-brutal">
            <CardHeader>
              <CardTitle>I Tuoi Campionati</CardTitle>
            </CardHeader>
            <CardContent>
              {user.leagues.length === 0 ? (
                <p className="font-bold">Non sei iscritto a nessun campionato.</p>
              ) : (
                <div className="space-y-6">
                  {user.leagues.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i).map(league => {
                    const isAdmin = league.adminId === user.id
                    const member = user.memberships?.find(m => m.leagueId === league.id)
                    const teamName = member?.teamName || league.homeTeam

                    return (
                      <div key={league.id} className="border-[3px] border-black p-4 bg-gray-50 flex flex-col gap-4 min-w-0">
                        <div className="flex justify-between items-center gap-2 min-w-0">
                          <h3 className="text-xl font-bold uppercase truncate min-w-0 flex-1">{league.name}</h3>
                          {isAdmin && <span className="bg-yellow-300 text-xs font-black px-2 py-1 border-[2px] border-black uppercase flex-shrink-0">Admin</span>}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Squadra:</span>
                          <span className="text-xs font-black bg-white px-2 py-0.5 border-[2px] border-black uppercase truncate max-w-[240px]">{teamName}</span>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Link href={`/league/${league.id}`}>
                            <Button variant="primary" className="w-full">Vai al Campionato</Button>
                          </Link>

                          {isAdmin ? (
                            <div className="space-y-4 mt-4 border-t-[2px] border-dashed border-gray-300 pt-4">
                              <DeleteLeagueForm leagueId={league.id} leagueName={league.name} />
                            </div>
                          ) : (
                            <form action={async () => {
                              "use server"
                              await leaveLeague(league.id)
                            }}>
                              <Button variant="destructive" type="submit" className="w-full mt-2">Abbandona Campionato</Button>
                            </form>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mt-6 flex flex-col sm:flex-row gap-4 border-t-[3px] border-dashed border-black pt-6">
                <Link href="/league/create" className="flex-1">
                  <Button className="w-full bg-white hover:bg-gray-100 text-black border-[3px] border-black shadow-brutal-sm font-bold">
                    ➕ Crea Campionato
                  </Button>
                </Link>
                <Link href="/league/join" className="flex-1">
                  <Button variant="primary" className="w-full font-bold">
                    🔑 Unisciti a Campionato
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>



          <div className="bg-white border-[4px] border-black p-6 shadow-[4px_4px_0_rgba(0,0,0,1)] flex flex-col items-center justify-center text-center space-y-4 mt-8">
            <h2 className="text-2xl font-black uppercase tracking-widest bg-yellow-300 px-2 border-[2px] border-black -rotate-2 inline-block">Assistenza</h2>
            <p className="font-bold text-gray-700">Hai riscontrato un problema tecnico, un bug o hai un suggerimento per migliorare l’app?</p>
            <p className="font-bold text-lg">
              Scrivi un’email: <a href={`mailto:${adminEmail}`} className="underline decoration-[3px] hover:text-primary transition-colors">{adminEmail}</a>
            </p>
          </div>
        </div>
      </main>
      <BottomNav leagueId={activeLeague?.id} />
    </div>
  )
}
