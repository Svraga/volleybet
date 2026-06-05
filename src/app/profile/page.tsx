import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import Link from "next/link"
import { updateNickname } from "@/actions/user"
import { leaveLeague } from "@/actions/league"
import { Home, CircleDollarSign } from "lucide-react"
import TourTrigger from "@/components/TourTrigger"

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      ledgers: true,
      bets: true
    }
  })

  if (!user) redirect("/")

  let adminEmail = "support@volleybet.it" // fallback
  let isAdmin = false
  let currentCoinName = "Coin"
  if (user.leagueId) {
    const league = await prisma.league.findUnique({
      where: { id: user.leagueId }
    })
    if (league) {
      currentCoinName = league.coinName
      isAdmin = league.adminId === user.id
      const adminUser = await prisma.user.findUnique({
        where: { id: league.adminId }
      })
      if (adminUser?.email) {
        adminEmail = adminUser.email
      }
    }
  }

  const totalCoins = user.ledgers.reduce((acc, l) => acc + l.amount, 0)
  const totalPoints = user.bets.reduce((acc, b) => acc + (b.pointsEarned || 0), 0)
  const exactHits = user.bets.filter(b => b.pointsEarned === 3).length
  const winnerHits = user.bets.filter(b => (b.pointsEarned || 0) >= 1).length
  const totalBets = user.bets.length
  const accuracy = totalBets > 0 ? Math.round((exactHits / totalBets) * 100) : 0

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-primary pt-12">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8 flex-wrap gap-4">
        <h1 className="text-4xl font-bold uppercase bg-white border-[4px] border-black shadow-brutal px-4 py-2 inline-block -rotate-1">
          Il tuo Profilo
        </h1>
        <Link href="/">
          <Button variant="outline" className="bg-white p-3"><Home className="w-6 h-6" /></Button>
        </Link>
      </div>

      <div className="grid gap-8 w-full max-w-2xl">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Saldo VolleyCoin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-2 text-3xl sm:text-4xl font-bold text-green-600 bg-gray-100 py-4 border-[3px] border-black shadow-brutal-sm rounded-brutal break-all px-2">
              <CircleDollarSign className="w-8 h-8 sm:w-10 sm:h-10 shrink-0" />
              <span>{Math.floor(totalCoins)} {currentCoinName}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Impostazioni Profilo</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateNickname} className="space-y-4">
              <div className="space-y-2">
                <label className="font-bold">Nickname Visualizzato</label>
                <div className="flex gap-4">
                  <Input name="nickname" defaultValue={user.name || ""} className="flex-1" />
                  <Button type="submit" variant="primary">Salva</Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Impostazioni Campionato (Admin)</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={async (data) => {
                "use server"
                const { updateCoinName } = await import("@/actions/league")
                await updateCoinName(data)
              }} className="space-y-4">
                <div className="space-y-2">
                  <label className="font-bold">Nome del Coin (max 15 car.)</label>
                  <div className="flex gap-4">
                    <Input name="coinName" defaultValue={currentCoinName} maxLength={15} className="flex-1" />
                    <Button type="submit" variant="primary">Aggiorna</Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {user.leagueId && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Tutorial</CardTitle>
            </CardHeader>
            <CardContent>
              <TourTrigger leagueId={user.leagueId} />
            </CardContent>
          </Card>
        )}

        {user.leagueId && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-red-600">Zona Pericolosa</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={leaveLeague}>
                <Button variant="destructive" type="submit" className="w-full font-bold text-lg">Abbandona Campionato</Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Le tue Statistiche</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4 text-xl">
              <li className="flex justify-between border-b-[3px] border-black pb-2">
                <span className="font-bold text-gray-600">Scommesse Piazzate</span>
                <span className="font-bold">{totalBets}</span>
              </li>
              <li className="flex justify-between border-b-[3px] border-black pb-2">
                <span className="font-bold text-gray-600">Punti Totali</span>
                <span className="font-bold">{totalPoints} pt</span>
              </li>
              <li className="flex justify-between border-b-[3px] border-black pb-2">
                <span className="font-bold text-gray-600">Risultati Esatti</span>
                <span className="font-bold">{exactHits}</span>
              </li>
              <li className="flex justify-between border-b-[3px] border-black pb-2">
                <span className="font-bold text-gray-600">Partite Prese</span>
                <span className="font-bold">{winnerHits}</span>
              </li>
              <li className="flex justify-between">
                <span className="font-bold text-gray-600">Precisione</span>
                <span className="font-bold">{accuracy}%</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {user.leagueId && (
          <div className="bg-white border-[4px] border-black p-6 shadow-[4px_4px_0_rgba(0,0,0,1)] flex flex-col items-center justify-center text-center space-y-4 mt-8">
            <h2 className="text-2xl font-black uppercase tracking-widest bg-yellow-300 px-2 border-[2px] border-black -rotate-2 inline-block">Assistenza</h2>
            <p className="font-bold text-gray-700">Hai riscontrato un problema tecnico, un bug o hai un suggerimento per migliorare l'app?</p>
            <p className="font-bold text-lg">
              Scrivi un'email: <a href={`mailto:${adminEmail}`} className="underline decoration-[3px] hover:text-primary transition-colors">{adminEmail}</a>
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
