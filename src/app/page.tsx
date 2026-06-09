import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { LoginButton, LogoutButton } from "@/components/AuthButtons"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-primary">
        
        <Card className="w-full max-w-md bg-white p-8">
          <div className="flex flex-col items-center space-y-8">
            <div className="space-y-2 text-center flex flex-col items-center">
              <img src="/volleybet_logo.png" alt="VolleyBet Logo" className="w-32 h-32 mb-4 border-[4px] border-black shadow-brutal rounded-full object-cover" />
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-none bg-white border-[4px] border-black shadow-brutal px-4 py-2 inline-block -rotate-2">
                VolleyBet
              </h1>
            </div>
            
            <LoginButton />
          </div>
        </Card>
      </main>
    )
  }

  // User is logged in
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { leagues: true }
  })

  if (user?.leagues && user.leagues.length > 0) {
    const cookieStore = await cookies()
    const lastLeagueId = cookieStore.get("lastLeagueId")?.value
    const belongsToLastLeague = lastLeagueId && user.leagues.some(l => l.id === lastLeagueId)
    
    if (belongsToLastLeague) {
      redirect(`/league/${lastLeagueId}`)
    } else {
      redirect(`/league/${user.leagues[0].id}`)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-primary pt-6">
      {/* Header Row: Logout and Welcome */}
      <div className="w-full max-w-4xl flex flex-col items-start mb-12 gap-6">
        <div className="shrink-0">
          <LogoutButton />
        </div>
        <h1 className="text-xl sm:text-3xl font-bold uppercase bg-white border-[3px] border-black shadow-brutal px-4 py-2 -rotate-1 max-w-full truncate">
          Benvenuto, {user?.name}!
        </h1>
      </div>

      {(!user?.leagues || user.leagues.length === 0) && (
        <div className="space-y-4 text-center mb-12">
          <p className="text-xl font-bold">Non appartieni a nessun campionato al momento.</p>
        </div>
      )}

      {user?.leagues && user.leagues.length > 0 && (
        <div className="w-full max-w-4xl mb-12">
          <h2 className="text-2xl font-black uppercase mb-6 bg-yellow-300 px-3 py-1 inline-block border-[3px] border-black -rotate-1 shadow-brutal-sm">
            I Tuoi Campionati
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {user.leagues.map(league => (
              <Link href={`/league/${league.id}`} key={league.id} className="block">
                <Card className="bg-white border-[3px] border-black shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm transition-all h-full flex flex-col justify-center text-center p-6">
                  <h3 className="text-xl font-bold uppercase">{league.name}</h3>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card className="bg-secondary flex flex-col justify-between">
          <CardHeader className="py-4">
            <CardTitle className="text-xl sm:text-2xl uppercase">Crea Campionato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-4">
            <p className="font-bold text-base">Crea un nuovo campionato, imposta le regole e invita i tuoi compagni di squadra.</p>
            <Link href="/league/create" className="block">
              <Button className="w-full text-lg py-4 bg-white">Crea Ora</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-white flex flex-col justify-between">
          <CardHeader className="py-4">
            <CardTitle className="text-xl sm:text-2xl uppercase">Unisciti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-4">
            <p className="font-bold text-base">Hai un codice invito? Unisciti al campionato della tua squadra.</p>
            <Link href="/league/join" className="block">
              <Button variant="primary" className="w-full text-lg py-4">Inserisci Codice</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
