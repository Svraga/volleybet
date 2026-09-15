import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import SubmitButton from "@/components/SubmitButton"
import { placeBets } from "@/actions/bet"
import { TriangleAlert } from "lucide-react"

export default async function BettingPage({ params }: { params: Promise<{ id: string, matchdayId: string }> }) {
  const { id, matchdayId } = await params;
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/")

  const league = await prisma.league.findUnique({
    where: { id }
  })
  if (!league) redirect("/")

  const matchDay = await prisma.matchDay.findUnique({
    where: { id: matchdayId },
    include: { matches: { include: { bets: { include: { user: true } } } } }
  })

  if (!matchDay || matchDay.leagueId !== league.id || matchDay.status !== "OPEN") {
    redirect(`/league/${league.id}`)
  }

  const isDeadlinePassed = new Date() > matchDay.deadline
  
  const boundPlaceBets = placeBets.bind(null, league.id, matchDay.id)

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-primary pt-12 pb-32">
      <div className="w-full max-w-3xl flex flex-col items-center gap-4 mb-8">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 mt-4 w-full justify-center">
          <h1 className="text-2xl md:text-4xl font-bold uppercase bg-white border-[4px] border-black shadow-brutal px-4 py-2 inline-block md:-rotate-1 text-center w-full md:w-auto">
            Scommetti: Giornata {matchDay.number}
          </h1>
          <div className="bg-yellow-300 border-[3px] border-black px-4 py-2 md:rotate-2 shadow-[2px_2px_0_rgba(0,0,0,1)] text-center transform hover:rotate-0 transition-transform flex items-center justify-center flex-col">
            <p className="font-black uppercase text-sm flex items-center gap-1">
              <TriangleAlert className="w-4 h-4" strokeWidth={2.5} />
              Scadenza
            </p>
            <p className="font-bold text-lg leading-tight">
              {new Date(matchDay.deadline).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
            </p>
          </div>
        </div>
      </div>

      <Card className="w-full max-w-3xl bg-white border-[4px] border-black shadow-brutal">
        <form action={boundPlaceBets}>
          <CardHeader className="border-b-[3px] border-black bg-secondary">
            <CardTitle>Le tue scommesse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 overflow-x-auto max-w-full">
            {matchDay.matches.map(m => {
              const isHomeTeam = m.teamA === league.homeTeam || m.teamB === league.homeTeam
              if (isHomeTeam) return null;

              const existingBet = m.bets.find(b => b.userId === session.user.id)
              const existingValue = existingBet ? `${existingBet.predictedA}-${existingBet.predictedB}` : ""
              
              return (
                <div key={m.id} className="p-3 border-[3px] border-black shadow-brutal bg-white transition-all hover:-translate-y-1">
                  <div className="flex flex-col sm:flex-row justify-between items-center font-bold text-sm sm:text-base mb-3 gap-2 min-w-0">
                    <span className="text-center sm:text-left flex-1 break-words line-clamp-2 w-full min-w-0">{m.teamA}</span>
                    <span className="flex-none bg-black text-white px-2 py-0.5 text-xs rotate-2">VS</span>
                    <span className="text-center sm:text-right flex-1 break-words line-clamp-2 w-full min-w-0">{m.teamB}</span>
                  </div>
                  
                  <div className="mt-4 flex flex-col md:flex-row md:justify-end md:items-center gap-2">
                    <select 
                      name={`bet_${m.id}`} 
                      className={`h-10 rounded-brutal border-[3px] border-black bg-white px-3 font-black focus:outline-none focus:bg-yellow-100 ${isDeadlinePassed ? 'opacity-50 cursor-not-allowed bg-gray-200' : ''}`}
                      defaultValue={existingValue}
                      disabled={isDeadlinePassed}
                    >
                      <option value="" disabled className="text-gray-400">Seleziona</option>
                      <option value="3-0">3 - 0</option>
                      <option value="3-1">3 - 1</option>
                      <option value="3-2">3 - 2</option>
                      <option value="2-3">2 - 3</option>
                      <option value="1-3">1 - 3</option>
                      <option value="0-3">0 - 3</option>
                    </select>
                  </div>
                </div>
              )
            })}

            {!isDeadlinePassed && (
              <div className="pt-6">
                <SubmitButton 
                  variant="primary" 
                  className="w-full text-xl h-16" 
                  defaultText="Conferma Scommesse"
                  loadingText="SALVATAGGIO..."
                />
              </div>
            )}
            {isDeadlinePassed && (
              <div className="pt-6 text-center text-red-500 font-bold text-xl uppercase">
                Scadenza passata
              </div>
            )}
          </CardContent>
        </form>
      </Card>

      {isDeadlinePassed && (
        <Card className="w-full max-w-3xl bg-white border-[4px] border-black shadow-brutal mt-8">
          <CardHeader className="border-b-[3px] border-black bg-blue-100">
            <CardTitle>Scommesse degli altri giocatori (Trasparenza)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <p className="font-bold text-gray-700">
              Essendo passata la scadenza, tutte le scommesse sono ora pubbliche. 
              Nessuno, nemmeno l'amministratore, può più modificarle senza lasciare traccia.
            </p>
            {matchDay.matches.map(m => {
              const isHomeTeam = m.teamA === league.homeTeam || m.teamB === league.homeTeam;
              if (isHomeTeam) return null;

              return (
                <div key={m.id} className="border-[2px] border-black p-3">
                  <div className="font-bold mb-2 border-b-[2px] border-black pb-1 truncate" title={`${m.teamA} - ${m.teamB}`}>
                    {m.teamA} - {m.teamB}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {m.bets.length === 0 ? (
                      <p className="text-sm italic text-gray-500">Nessuna scommessa.</p>
                    ) : (
                      m.bets.map(b => (
                        <div key={b.id} className="flex justify-between items-center bg-gray-100 px-2 py-1 text-sm font-bold border border-black">
                          <span className="truncate mr-2" title={b.user.name || "Utente"}>{b.user.name}</span>
                          <span className="bg-white px-1 border border-black shrink-0">{b.predictedA}-{b.predictedB}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
