"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import { AlertTriangle } from "lucide-react"
import DeleteMatchDayButton from "./DeleteMatchDayButton"
import { setMatches } from "@/actions/matchday"
import { scoreMatchDay } from "@/actions/score"
import { proxyPlaceBets } from "@/actions/proxyBet"

export default function AdminMatchdayPanel({ 
  leagueId, 
  matchDay, 
  teams,
  users
}: { 
  leagueId: string, 
  matchDay: any, 
  teams: any[],
  users: any[] // Users with their bets for this matchday
}) {
  const [activeTab, setActiveTab] = useState<"matches" | "results" | "proxy">("matches")
  const isMatchDayEmpty = matchDay.matches.length === 0
  const isScored = matchDay.status === "SCORED"
  const isClosed = matchDay.status === "CLOSED" || new Date() > new Date(matchDay.deadline)

  // Popups and beforeunload removed as per request - will be handled by AdminHeader



  // SECTION 1: Match Management
  const initialRows = Math.max(1, Math.floor(teams.length / 2))
  const [numFixedRows, setNumFixedRows] = useState(initialRows)
  const [selectedTeams, setSelectedTeams] = useState<string[]>(Array(initialRows * 2).fill(""))
  
  const handleTeamChange = (index: number, val: string) => {
    const newSelected = [...selectedTeams]
    newSelected[index] = val
    setSelectedTeams(newSelected)
  }

  const handleAddRow = () => {
    setNumFixedRows(prev => prev + 1)
    setSelectedTeams(prev => [...prev, "", ""])
  }

  const handleSaveMatches = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    await setMatches(leagueId, matchDay.id, formData)
  }

  // SECTION 2: Score Form
  const handleScoreMatches = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    await scoreMatchDay(leagueId, matchDay.id, formData)
  }

  // SECTION 3: Proxy Bet
  const usersWhoBet = users.filter(u => u.bets && u.bets.length > 0)
  const usersMissing = users.filter(u => !u.bets || u.bets.length === 0)
  
  const [selectedProxyUser, setSelectedProxyUser] = useState("")
  
  const handleProxyBet = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedProxyUser) return
    const formData = new FormData(e.currentTarget)
    formData.append("userId", selectedProxyUser)
    await proxyPlaceBets(leagueId, matchDay.id, formData)
    setSelectedProxyUser("") // reset after success
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button 
          onClick={() => setActiveTab("matches")}
          className={`flex-1 min-w-[100px] border-[3px] border-black font-bold uppercase text-xs sm:text-sm py-2 px-1 transition-all ${activeTab === "matches" ? 'bg-yellow-300 shadow-[2px_2px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]' : 'bg-white hover:bg-gray-100'}`}
        >
          Gestione Partite
        </button>
        {!isMatchDayEmpty && (
          <button 
            onClick={() => setActiveTab("results")}
            className={`flex-1 min-w-[100px] border-[3px] border-black font-bold uppercase text-xs sm:text-sm py-2 px-1 transition-all ${activeTab === "results" ? 'bg-green-400 shadow-[2px_2px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]' : 'bg-white hover:bg-gray-100'}`}
          >
            Inserimento Risultati
          </button>
        )}
        {!isMatchDayEmpty && (
          <button 
            onClick={() => setActiveTab("proxy")}
            className={`flex-1 min-w-[100px] border-[3px] border-black font-bold uppercase text-xs sm:text-sm py-2 px-1 transition-all ${activeTab === "proxy" ? 'bg-purple-400 text-white shadow-[2px_2px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]' : 'bg-white text-black hover:bg-gray-100'}`}
          >
            Logistica & Proxy
          </button>
        )}
      </div>

      {/* SECTION 1: Gestione Partite */}
      {activeTab === "matches" && (
        <div className="border-[4px] border-black p-4 shadow-brutal bg-white">
          <h3 className="text-xl font-bold uppercase mb-4 bg-yellow-300 inline-block px-2 border-[2px] border-black -rotate-1">1. Gestione Partite</h3>
          
          {isMatchDayEmpty ? (
          <form onSubmit={handleSaveMatches} className="space-y-4">
            {Array.from({ length: numFixedRows }).map((_, i) => (
              <div key={`row_${i}`} className="flex flex-col md:flex-row gap-2 border-[2px] border-gray-300 p-2 shadow-brutal-sm">
                <div className="flex-1">
                  <label className="text-xs font-bold">Casa</label>
                  <select 
                    name={`teamA_${i}`} 
                    required 
                    value={selectedTeams[i * 2]}
                    onChange={(e) => handleTeamChange(i * 2, e.target.value)}
                    className="w-full border-[2px] border-black px-2 py-1 focus:shadow-brutal-sm outline-none font-bold"
                  >
                    <option value="" disabled className="text-gray-400">Seleziona Casa</option>
                    {teams.map(t => (
                      <option key={`A_${i}_${t.id}`} value={t.name} disabled={selectedTeams.includes(t.name) && selectedTeams[i * 2] !== t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold">Ospite</label>
                  <select 
                    name={`teamB_${i}`} 
                    required 
                    value={selectedTeams[i * 2 + 1]}
                    onChange={(e) => handleTeamChange(i * 2 + 1, e.target.value)}
                    className="w-full border-[2px] border-black px-2 py-1 focus:shadow-brutal-sm outline-none font-bold"
                  >
                    <option value="" disabled className="text-gray-400">Seleziona Ospite</option>
                    {teams.map(t => (
                      <option key={`B_${i}_${t.id}`} value={t.name} disabled={selectedTeams.includes(t.name) && selectedTeams[i * 2 + 1] !== t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            <div className="flex justify-end mt-2">
              <Button type="button" variant="outline" className="text-xs" onClick={handleAddRow}>+ Aggiungi Riga</Button>
            </div>
            <input type="hidden" name="numRows" value={numFixedRows} />
            <Button type="submit" variant="primary" className="w-full uppercase font-bold text-sm mt-4">
              Salva Accoppiamenti
            </Button>
          </form>
        ) : (
          <div className="space-y-2">
            {matchDay.matches.map((m: any) => (
              <div key={m.id} className="flex justify-between items-center border-[2px] border-black p-2 font-bold shadow-brutal-sm">
                <span>{m.teamA} vs {m.teamB}</span>
                <span className="font-bold border-[2px] border-black p-1 bg-yellow-100 flex-shrink-0 whitespace-nowrap">
                  {m.resultA !== null && m.resultB !== null ? `${m.resultA} - ${m.resultB}` : "Da giocare"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

      {/* SECTION 2: Inserimento Risultati */}
      {activeTab === "results" && !isMatchDayEmpty && (
        <div className="border-[4px] border-black p-4 shadow-brutal bg-white">
          <h3 className="text-xl font-bold uppercase mb-4 bg-green-400 inline-block px-2 border-[2px] border-black -rotate-1">2. Inserimento Risultati</h3>
          <form onSubmit={handleScoreMatches} className="space-y-4">
            {matchDay.matches.map((m: any) => {
              const existingValue = m.resultA !== null && m.resultB !== null ? `${m.resultA}-${m.resultB}` : ""
              return (
                <div key={`res_${m.id}`} className="flex justify-between items-center gap-4">
                  <span className="font-bold text-sm flex-1">{m.teamA} - {m.teamB}</span>
                  <select 
                    name={`result_${m.id}`} 
                    defaultValue={existingValue}
                    required
                    className="h-10 border-[3px] border-black bg-white px-2 py-1 font-bold focus:outline-none focus:shadow-brutal-sm" 
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
              )
            })}
            <Button type="submit" variant="primary" className="w-full mt-4 uppercase">
              Termina e Calcola
            </Button>
          </form>
        </div>
      )}

      {/* SECTION 3: Logistica e Proxy-Bet */}
      {activeTab === "proxy" && !isMatchDayEmpty && (
        <div className="border-[4px] border-black p-4 shadow-brutal bg-white">
          <h3 className="text-xl font-bold uppercase mb-4 bg-purple-400 text-white inline-block px-2 border-[2px] border-black -rotate-1">3. Logistica & Proxy-Bet</h3>
          
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="border-[2px] border-black p-2 bg-gray-50">
              <h4 className="font-bold text-sm border-b-[2px] border-black pb-1 mb-2">Hanno Scommesso</h4>
              <ul className="text-sm font-bold text-green-700 space-y-1">
                {usersWhoBet.length === 0 && <li className="text-gray-400">Nessuno</li>}
                {usersWhoBet.map(u => <li key={u.id}>✓ {u.name}</li>)}
              </ul>
            </div>
            <div className="border-[2px] border-black p-2 bg-gray-50">
              <h4 className="font-bold text-sm border-b-[2px] border-black pb-1 mb-2">Mancanti</h4>
              <ul className="text-sm font-bold text-red-700 space-y-1">
                {usersMissing.length === 0 && <li className="text-gray-400">Nessuno</li>}
                {usersMissing.map(u => <li key={u.id}>✗ {u.name}</li>)}
              </ul>
            </div>
          </div>

          {usersMissing.length > 0 && !isScored && (
            <div className="border-t-[3px] border-black pt-4">
              <h4 className="font-bold mb-2 uppercase">Proxy Bet (Piazza per altri)</h4>
              <form onSubmit={handleProxyBet} className="space-y-4">
                <select 
                  className="w-full border-[3px] border-black p-2 font-bold" 
                  required
                  value={selectedProxyUser}
                  onChange={e => setSelectedProxyUser(e.target.value)}
                >
                  <option value="" disabled>Seleziona Utente Mancante...</option>
                  {usersMissing.map(u => (
                    <option key={`proxy_${u.id}`} value={u.id}>{u.name}</option>
                  ))}
                </select>

                {selectedProxyUser && (
                  <div className="space-y-2 border-[2px] border-black p-2 bg-yellow-100">
                    {matchDay.matches.map((m: any) => {
                      const isHomeTeam = m.teamA === teams.find(t=>t.isHome)?.name || m.teamB === teams.find(t=>t.isHome)?.name;
                      if (isHomeTeam) return null; // Proxy can't bet on home team either usually? Wait, home team is league level, I don't have it here. Let's pass it.
                      return (
                        <div key={`proxy_m_${m.id}`} className="flex justify-between items-center text-sm font-bold">
                          <span>{m.teamA} - {m.teamB}</span>
                          <select name={`bet_${m.id}`} required defaultValue="" className="border-[2px] border-black px-1">
                            <option value="" disabled className="text-gray-400">0-0</option>
                            <option value="3-0">3-0</option>
                            <option value="3-1">3-1</option>
                            <option value="3-2">3-2</option>
                            <option value="2-3">2-3</option>
                            <option value="1-3">1-3</option>
                            <option value="0-3">0-3</option>
                          </select>
                        </div>
                      )
                    })}
                    <Button type="submit" variant="secondary" className="w-full text-xs">Salva Proxy-Bet</Button>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
