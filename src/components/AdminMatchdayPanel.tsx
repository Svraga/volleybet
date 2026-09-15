"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { setMatches, updateDeadline } from "@/actions/matchday"
import { scoreMatchDay } from "@/actions/score"
import { proxyPlaceBets } from "@/actions/proxyBet"
import SubmitButton from "@/components/SubmitButton"

export default function AdminMatchdayPanel({ 
  leagueId, 
  homeTeam,
  matchDay, 
  teams,
  hasOddTeams,
  users
}: { 
  leagueId: string, 
  homeTeam: string,
  matchDay: any, 
  teams: any[],
  hasOddTeams: boolean,
  users: any[] // Users with their bets for this matchday
}) {
  const [activeTab, setActiveTab] = useState<"matches" | "results" | "proxy">("matches")
  const isMatchDayEmpty = matchDay.matches.length === 0
  const isScored = matchDay.status === "SCORED"
  const isClosed = matchDay.status === "CLOSED" || new Date() > new Date(matchDay.deadline)
  const [isEditingMatches, setIsEditingMatches] = useState(false)

  // SECTION 1: Match Management
  const initialRows = Math.floor(teams.length / 2)
  const numFixedRows = initialRows
  
  // Pre-populate if editing existing matches
  const initialSelectedTeams = () => {
    if (matchDay.matches.length > 0) {
      const arr = Array(initialRows * 2).fill("")
      matchDay.matches.slice(0, initialRows).forEach((m: any, idx: number) => {
        arr[idx * 2] = m.teamA
        arr[idx * 2 + 1] = m.teamB
      })
      return arr
    }
    return Array(initialRows * 2).fill("")
  }

  const [selectedTeams, setSelectedTeams] = useState<string[]>(initialSelectedTeams)
  const [restingTeam, setRestingTeam] = useState<string>(matchDay.restingTeam || "")
  
  const handleTeamChange = (index: number, val: string) => {
    const newSelected = [...selectedTeams]
    newSelected[index] = val
    setSelectedTeams(newSelected)
  }

  const boundSetMatches = setMatches.bind(null, leagueId, matchDay.id)
  const boundScoreMatchDay = scoreMatchDay.bind(null, leagueId, matchDay.id)
  const boundUpdateDeadline = updateDeadline.bind(null, leagueId, matchDay.id)
  const boundProxyPlaceBets = proxyPlaceBets.bind(null, leagueId, matchDay.id)

  const usersWhoBet = users.filter(u => u.bets && u.bets.length > 0)
  const usersMissing = users.filter(u => !u.bets || u.bets.length === 0)
  const [selectedProxyUser, setSelectedProxyUser] = useState("")

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 w-full">
        <div className="grid grid-cols-2 gap-2 w-full">
          <button 
            type="button"
            onClick={() => setActiveTab("matches")}
            className={`border-[3px] border-black font-bold uppercase text-xs sm:text-sm py-2 px-1 transition-all ${isMatchDayEmpty ? 'col-span-2' : ''} ${activeTab === "matches" ? 'bg-yellow-300' : 'bg-white hover:bg-gray-100'}`}
          >
            Gestione Partite
          </button>
          {!isMatchDayEmpty && (
            <button 
              type="button"
              onClick={() => setActiveTab("results")}
              className={`border-[3px] border-black font-bold uppercase text-xs sm:text-sm py-2 px-1 transition-all ${activeTab === "results" ? 'bg-green-400' : 'bg-white hover:bg-gray-100'}`}
            >
              {isScored ? "Modifica Risultati" : "Inserimento Risultati"}
            </button>
          )}
        </div>
        {!isMatchDayEmpty && (
          <button 
            type="button"
            onClick={() => setActiveTab("proxy")}
            className={`border-[3px] border-black font-bold uppercase text-xs sm:text-sm py-2 px-1 transition-all w-full ${activeTab === "proxy" ? 'bg-purple-400 text-white' : 'bg-white text-black hover:bg-gray-100'}`}
          >
            Logistica & Proxy
          </button>
        )}
      </div>

      {/* SECTION 1: Gestione Partite */}
      {activeTab === "matches" && (
        <div className="border-[4px] border-black p-4 shadow-brutal bg-white">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h3 className="text-xl font-bold uppercase bg-yellow-300 inline-block px-2 border-[2px] border-black -rotate-1">
              1. Gestione Partite
            </h3>
            {!isMatchDayEmpty && !isClosed && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditingMatches(!isEditingMatches)}
                className="text-xs h-8 px-2 border-[2px] border-black"
              >
                {isEditingMatches ? "Annulla Modifica" : "✏️ Modifica Accoppiamenti"}
              </Button>
            )}
          </div>
          
          {isMatchDayEmpty || isEditingMatches ? (
            <form action={boundSetMatches} className="space-y-4">
              {isEditingMatches && (
                <p className="text-xs font-bold text-amber-700 bg-amber-50 p-2 border-[2px] border-amber-400">
                  Attenzione: modificando gli accoppiamenti, le scommesse precedentemente inserite per questa giornata verranno resettate.
                </p>
              )}
              {Array.from({ length: numFixedRows }).map((_, i) => (
                <div key={`row_${i}`} className="flex flex-col gap-2 border-[2px] border-gray-300 p-2 shadow-brutal-sm bg-gray-50 min-w-0 w-full">
                  <div className="w-full min-w-0">
                    <label className="text-[10px] uppercase font-black text-gray-500">Squadra Casa</label>
                    <select 
                      name={`teamA_${i}`} 
                      required 
                      value={selectedTeams[i * 2]}
                      onChange={(e) => handleTeamChange(i * 2, e.target.value)}
                      className="w-full border-[2px] border-black px-2 py-1 bg-white focus:shadow-brutal-sm outline-none font-bold text-sm truncate"
                    >
                      <option value="" disabled className="text-gray-400">Seleziona Casa</option>
                      {teams.map(t => (
                        <option key={`A_${i}_${t.id}`} value={t.name} disabled={(selectedTeams.includes(t.name) && selectedTeams[i * 2] !== t.name) || t.name === restingTeam}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full min-w-0">
                    <label className="text-[10px] uppercase font-black text-gray-500">Squadra Ospite</label>
                    <select 
                      name={`teamB_${i}`} 
                      required 
                      value={selectedTeams[i * 2 + 1]}
                      onChange={(e) => handleTeamChange(i * 2 + 1, e.target.value)}
                      className="w-full border-[2px] border-black px-2 py-1 bg-white focus:shadow-brutal-sm outline-none font-bold text-sm truncate"
                    >
                      <option value="" disabled className="text-gray-400">Seleziona Ospite</option>
                      {teams.map(t => (
                        <option key={`B_${i}_${t.id}`} value={t.name} disabled={(selectedTeams.includes(t.name) && selectedTeams[i * 2 + 1] !== t.name) || t.name === restingTeam}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              {hasOddTeams && (
                <div className="flex flex-col gap-2 border-[2px] border-black p-2 bg-gray-100 shadow-brutal-sm mt-4 min-w-0 w-full">
                  <label className="text-sm font-bold">Squadra che RIPOSA</label>
                  <select 
                    name="restingTeam" 
                    required 
                    value={restingTeam}
                    onChange={(e) => setRestingTeam(e.target.value)}
                    className="w-full border-[2px] border-black px-2 py-1 focus:shadow-brutal-sm outline-none font-bold truncate"
                  >
                    <option value="" disabled className="text-gray-400">Seleziona Squadra che Riposa</option>
                    {teams.map(t => (
                      <option key={`R_${t.id}`} value={t.name} disabled={selectedTeams.includes(t.name)}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <input type="hidden" name="numRows" value={numFixedRows} />
              <SubmitButton variant="primary" className="w-full uppercase font-bold text-sm mt-4" defaultText="Salva Accoppiamenti" loadingText="SALVATAGGIO..." />
            </form>
          ) : (
            <div className="space-y-2">
              {matchDay.matches.map((m: any) => (
                <div key={m.id} className="flex justify-between items-center border-[2px] border-black p-2 font-bold shadow-brutal-sm gap-2 min-w-0 bg-white">
                  <div className="flex flex-col items-center flex-1 min-w-0 text-center leading-tight">
                    <span className="truncate w-full block text-[11px] sm:text-xs" title={m.teamA}>{m.teamA}</span>
                    <span className="text-[9px] uppercase font-black tracking-wider text-gray-500 my-0.5">vs</span>
                    <span className="truncate w-full block text-[11px] sm:text-xs" title={m.teamB}>{m.teamB}</span>
                  </div>
                  <span className="font-bold border-[2px] border-black px-1 py-0 bg-yellow-100 flex-shrink-0 whitespace-nowrap text-[10px] leading-relaxed">
                    {m.resultA !== null && m.resultB !== null ? `${m.resultA} - ${m.resultB}` : "Da giocare"}
                  </span>
                </div>
              ))}
              {hasOddTeams && matchDay.restingTeam && (
                <div className="flex justify-between items-center border-[2px] border-black p-2 font-bold shadow-brutal-sm bg-gray-200 gap-2 min-w-0">
                  <span className="truncate flex-1 min-w-0 text-[11px] sm:text-xs text-center" title={matchDay.restingTeam}>{matchDay.restingTeam}</span>
                  <span className="font-bold border-[2px] border-black px-1 py-0 bg-white flex-shrink-0 whitespace-nowrap text-[10px] leading-relaxed">
                    RIPOSA
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Inserimento Risultati / Modifica Risultati */}
      {activeTab === "results" && !isMatchDayEmpty && (
        <div className="border-[4px] border-black p-4 shadow-brutal bg-white">
          <h3 className="text-xl font-bold uppercase mb-4 bg-green-400 inline-block px-2 border-[2px] border-black -rotate-1">
            2. {isScored ? "Modifica Risultati (Re-Scoring)" : "Inserimento Risultati"}
          </h3>
          
          {isScored && (
            <div className="mb-4 bg-yellow-100 border-[3px] border-black p-3 text-xs sm:text-sm font-bold shadow-brutal-sm">
              ⚠️ <strong>Risultati già calcolati.</strong> Se modifichi i risultati e salvi, la classifica verrà ricalcolata automaticamente e i premi precedenti verranno corretti.
            </div>
          )}

          <form action={boundScoreMatchDay} className="space-y-4">
            {matchDay.matches.map((m: any) => {
              const existingValue = m.resultA !== null && m.resultB !== null ? `${m.resultA}-${m.resultB}` : ""
              return (
                <div key={`res_${m.id}`} className="flex justify-between items-center gap-2 min-w-0 border-[2px] border-black p-2 bg-gray-50 shadow-brutal-sm">
                  <div className="flex flex-col items-center flex-1 min-w-0 text-center leading-tight">
                    <span className="truncate w-full block text-[11px] sm:text-xs font-bold" title={m.teamA}>{m.teamA}</span>
                    <span className="text-[9px] uppercase font-black tracking-wider text-gray-500 my-0.5">vs</span>
                    <span className="truncate w-full block text-[11px] sm:text-xs font-bold" title={m.teamB}>{m.teamB}</span>
                  </div>
                  <select 
                    name={`result_${m.id}`} 
                    defaultValue={existingValue}
                    required
                    className="h-8 border-[2px] border-black bg-white px-2 py-0 text-xs font-bold focus:outline-none focus:shadow-brutal-sm flex-shrink-0" 
                  >
                    <option value="" disabled className="text-gray-400">Sel.</option>
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
            <SubmitButton 
              variant="primary" 
              className="w-full mt-4 uppercase font-black" 
              defaultText={isScored ? "Ricalcola e Aggiorna Risultati" : "Termina e Calcola"} 
              loadingText={isScored ? "RICALCOLO IN CORSO..." : "CALCOLANDO..."} 
            />
          </form>
        </div>
      )}

      {/* SECTION 3: Logistica e Proxy-Bet */}
      {activeTab === "proxy" && !isMatchDayEmpty && (
        <div className="border-[4px] border-black p-4 shadow-brutal bg-white">
          <h3 className="text-xl font-bold uppercase mb-4 bg-purple-400 text-white inline-block px-2 border-[2px] border-black -rotate-1">3. Logistica & Proxy-Bet</h3>
          
          <div className="mb-6 p-3 border-[3px] border-black bg-purple-50">
            <h4 className="font-bold text-sm border-b-[2px] border-black pb-1 mb-2">Modifica Scadenza (Deadline)</h4>
            <form action={boundUpdateDeadline} className="flex flex-col gap-3">
              <input 
                type="datetime-local" 
                name="deadline" 
                defaultValue={new Date(new Date(matchDay.deadline).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                className="w-full border-[2px] border-black px-3 py-2 font-bold text-sm bg-white" 
                required 
              />
              <SubmitButton variant="primary" className="w-full text-sm h-10 uppercase" defaultText="Aggiorna Scadenza" loadingText="IN CORSO..." />
            </form>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="border-[2px] border-black p-2 bg-gray-50">
              <h4 className="font-bold text-sm border-b-[2px] border-black pb-1 mb-2">Hanno Scommesso</h4>
              <ul className="text-sm font-bold text-green-700 space-y-1">
                {usersWhoBet.length === 0 && <li className="text-gray-400">Nessuno</li>}
                {usersWhoBet.map(u => (
                  <li key={u.id} className="flex items-center justify-between gap-1">
                    <span className="truncate">✓ {u.name}</span>
                    <span className="text-[10px] bg-white text-black px-1 border border-black shrink-0 font-bold">{u.teamName || homeTeam}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-[2px] border-black p-2 bg-gray-50">
              <h4 className="font-bold text-sm border-b-[2px] border-black pb-1 mb-2">Mancanti</h4>
              <ul className="text-sm font-bold text-red-700 space-y-1">
                {usersMissing.length === 0 && <li className="text-gray-400">Nessuno</li>}
                {usersMissing.map(u => (
                  <li key={u.id} className="flex items-center justify-between gap-1">
                    <span className="truncate">✗ {u.name}</span>
                    <span className="text-[10px] bg-white text-black px-1 border border-black shrink-0 font-bold">{u.teamName || homeTeam}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {usersMissing.length > 0 && !isScored && (
            <div className="border-t-[3px] border-black pt-4">
              <h4 className="font-bold mb-2 uppercase">Scommetti per altri</h4>
              <form action={async (formData) => {
                if (!selectedProxyUser) return;
                formData.append("userId", selectedProxyUser);
                await boundProxyPlaceBets(formData);
                setSelectedProxyUser("");
              }} className="space-y-4">
                <select 
                  className="w-full border-[3px] border-black p-2 font-bold truncate" 
                  required
                  value={selectedProxyUser}
                  onChange={e => setSelectedProxyUser(e.target.value)}
                >
                  <option value="" disabled>Seleziona Utente</option>
                  {usersMissing.map(u => (
                    <option key={`proxy_${u.id}`} value={u.id}>
                      {u.name} ({u.teamName || homeTeam})
                    </option>
                  ))}
                </select>

                {selectedProxyUser && (() => {
                  const targetUser = users.find(u => u.id === selectedProxyUser);
                  const targetUserTeam = targetUser?.teamName || homeTeam;

                  return (
                    <div className="space-y-2 border-[2px] border-black p-2 bg-yellow-100">
                      <div className="bg-white border-[2px] border-black px-2 py-1 text-xs font-bold flex justify-between items-center">
                        <span>Squadra di {targetUser?.name || "Utente"}:</span>
                        <span className="font-black bg-yellow-300 px-1 border border-black uppercase">{targetUserTeam}</span>
                      </div>
                      {matchDay.matches.map((m: any) => {
                        const isTargetTeam = m.teamA === targetUserTeam || m.teamB === targetUserTeam;
                        if (isTargetTeam) return null; // Target user's team match is excluded
                        return (
                          <div key={`proxy_m_${m.id}`} className="flex justify-between items-center text-sm font-bold gap-4 min-w-0 border-[2px] border-black p-3 bg-white shadow-brutal-sm">
                            <div className="flex flex-col items-center flex-1 min-w-0 text-center leading-tight">
                              <span className="truncate w-full block text-xs font-bold" title={m.teamA}>{m.teamA}</span>
                              <span className="text-[9px] uppercase font-black tracking-wider text-gray-500 my-0.5">vs</span>
                              <span className="truncate w-full block text-xs font-bold" title={m.teamB}>{m.teamB}</span>
                            </div>
                            <select name={`bet_${m.id}`} required defaultValue="" className="border-[2px] border-black px-1 py-0 text-xs flex-shrink-0 h-8 font-bold bg-white focus:outline-none">
                              <option value="" disabled className="text-gray-400">Sel.</option>
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
                      <SubmitButton variant="secondary" className="w-full text-xs font-black uppercase" defaultText="Salva Proxy-Bet" loadingText="SALVATAGGIO..." />
                    </div>
                  );
                })()}
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
