"use client"

import { useId, useState } from "react"

export type PredictionMatch = {
  id: string; teamA: string; teamB: string; resultA: number | null; resultB: number | null
  bets: { id: string; userId: string; name: string; predictedA: number; predictedB: number; points: number | null }[]
}

export default function PredictionsBoard({ matches, scored }: { matches: PredictionMatch[]; scored: boolean }) {
  const id = useId()
  const [player, setPlayer] = useState("all")
  const [team, setTeam] = useState("all")
  const players = Array.from(new Map(matches.flatMap(m => m.bets.map(b => [b.userId, b.name] as const))).entries()).sort((a, b) => a[1].localeCompare(b[1], "it"))
  const teams = Array.from(new Set(matches.flatMap(m => [m.teamA, m.teamB]))).sort((a, b) => a.localeCompare(b, "it"))
  const visible = matches.filter(m => (team === "all" || m.teamA === team || m.teamB === team) && (player === "all" || m.bets.some(b => b.userId === player)))
  return <div className="space-y-6">
    <div className="border-[3px] border-black bg-white p-4 shadow-brutal">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <label htmlFor={`${id}-player`} className="text-xs font-black uppercase">Giocatore</label>
          <select id={`${id}-player`} value={player} onChange={e => setPlayer(e.target.value)} className="w-full min-w-0 border-[2px] border-black bg-primary p-2 font-bold text-sm">
            <option value="all">Tutti i giocatori</option>
            {players.map(([userId, name]) => <option key={userId} value={userId}>{name}</option>)}
          </select>
        </div>
        <div className="min-w-0 space-y-1">
          <label htmlFor={`${id}-team`} className="text-xs font-black uppercase">Squadra in campo</label>
          <select id={`${id}-team`} value={team} onChange={e => setTeam(e.target.value)} className="w-full min-w-0 border-[2px] border-black bg-primary p-2 font-bold text-sm">
            <option value="all">Tutte le squadre</option>
            {teams.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </div>
      {(player !== "all" || team !== "all") && <button type="button" onClick={() => { setPlayer("all"); setTeam("all") }} className="mt-3 border-[2px] border-black bg-yellow-300 px-3 py-1 text-xs font-black shadow-brutal-sm">Azzera filtri</button>}
    </div>
    <div className="flex flex-wrap gap-2 text-xs font-bold" aria-label="Legenda punteggi">
      {scored ? [["bg-destructive", "0 punti"], ["bg-yellow-300", "1 punto"], ["bg-success", "3 punti"]].map(([color, label]) => <span key={label} className={`${color} border-[2px] border-black px-2 py-1 shadow-brutal-sm`}>{label}</span>) : <p className="border-[2px] border-black bg-white px-3 py-2">Giocate chiuse · In attesa dei risultati ufficiali</p>}
    </div>
    {visible.length === 0 && <p className="border-[3px] border-black bg-white p-5 font-bold shadow-brutal">Nessun pronostico per questi filtri.</p>}
    {visible.map(m => <section key={m.id} className="border-[3px] border-black bg-white shadow-brutal">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-black bg-primary p-3 sm:p-4">
        <h2 className="min-w-0 break-words font-black uppercase text-sm sm:text-base">{m.teamA} <span className="mx-1 text-xs">vs</span> {m.teamB}</h2>
        {scored && m.resultA !== null && m.resultB !== null && <span className="shrink-0 border-[2px] border-black bg-black px-2 py-1 text-sm font-black text-white" aria-label={`Risultato ufficiale ${m.resultA} a ${m.resultB}`}>{m.resultA} - {m.resultB}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:p-4 md:grid-cols-4">
        {m.bets.length === 0 && <p className="col-span-full text-sm font-bold text-gray-600">Nessun pronostico inserito.</p>}
        {m.bets.filter(b => player === "all" || b.userId === player).map(b => {
          const points = scored ? b.points : null
          const color = points === 3 ? "bg-success" : points === 1 ? "bg-yellow-300" : points === 0 ? "bg-destructive" : "bg-gray-100"
          return <div key={b.id} className={`${color} min-w-0 border-[2px] border-black px-2 py-2 shadow-brutal-sm`}>
            <p className="truncate text-[10px] font-bold leading-4" title={b.name}>{b.name}</p>
            <div className="mt-1 flex items-end justify-between gap-1">
              <span className="text-xl font-black leading-none">{b.predictedA}-{b.predictedB}</span>
              {points !== null && <span className="text-[10px] font-black">{points} pt</span>}
            </div>
          </div>
        })}
      </div>
    </section>)}
  </div>
}
