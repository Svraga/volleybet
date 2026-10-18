import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireLeagueMember } from "@/lib/security"
import { isDayClosed, isDayOpen } from "@/lib/matchday"
import MatchdayRefresh from "@/components/MatchdayRefresh"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import SubmitButton from "@/components/SubmitButton"
import { placeBets } from "@/actions/bet"
import { TriangleAlert } from "lucide-react"

export default async function BettingPage({ params }: { params: Promise<{ id: string, matchdayId: string }> }) {
  const { id, matchdayId } = await params;
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/")
  const league = await requireLeagueMember(id, session.user.id)

  if (!league) redirect("/")

  const matchDay = await prisma.matchDay.findUnique({
    where: { id: matchdayId },
    include: { matches: { include: { bets: {
      where: { userId: session.user.id },
      select: { id: true, userId: true, predictedA: true, predictedB: true, user: { select: { name: true } } }
    } } } }
  })

  if (!matchDay || matchDay.leagueId !== league.id) {
    redirect(`/league/${league.id}`)
  }
  if (isDayClosed(matchDay)) redirect(`/league/${league.id}/predictions?round=${matchDay.id}`)
  if (!isDayOpen(matchDay)) redirect(`/league/${league.id}`)

  const member = await prisma.leagueMember.findUnique({
    where: {
      userId_leagueId: {
        userId: session.user.id,
        leagueId: league.id,
      },
    },
  })
  if (!member) throw new Error("Iscrizione senza squadra: contatta l'amministratore")
  const userTeam = member.teamName

  const isDeadlinePassed = new Date().getTime() >= matchDay.deadline.getTime()
  
  const boundPlaceBets = placeBets.bind(null, league.id, matchDay.id)

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-primary pt-12 pb-32">
      <MatchdayRefresh at={[matchDay.deadline.getTime()]} />
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

        <div className="bg-white border-[3px] border-black p-3 shadow-brutal-sm text-center w-full">
          <span className="font-bold text-sm text-gray-700">La tua squadra: </span>
          <span className="font-black bg-yellow-300 px-2 py-0.5 border-[2px] border-black uppercase text-sm ml-1">{userTeam}</span>
          {matchDay.restingTeam === userTeam ? (
            <p className="text-xs font-bold text-green-700 mt-1">✨ La tua squadra riposa in questa giornata: puoi pronosticare su tutte le partite in programma!</p>
          ) : (
            <p className="text-xs font-bold text-gray-600 mt-1">La partita della tua squadra non è visibile per evitare conflitti d&apos;interesse.</p>
          )}
        </div>
      </div>

      <Card className="w-full max-w-3xl bg-white border-[4px] border-black shadow-brutal">
        <form action={boundPlaceBets}>
          <CardHeader className="border-b-[3px] border-black bg-secondary">
            <CardTitle>Le tue scommesse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 overflow-x-auto max-w-full">
            {matchDay.matches.map(m => {
              const isUserTeam = m.teamA === userTeam || m.teamB === userTeam
              if (isUserTeam) return null;

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

    </main>
  )
}
