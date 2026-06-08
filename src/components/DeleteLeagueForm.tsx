"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { deleteLeague } from "@/actions/league"

export default function DeleteLeagueForm({ leagueId, leagueName }: { leagueId: string, leagueName: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const isConfirmed = confirmText === "Conferma"

  if (!isExpanded) {
    return (
      <Button 
        variant="destructive" 
        onClick={() => setIsExpanded(true)} 
        className="w-full text-sm mt-4 border-[2px] border-black bg-red-100 text-red-600 shadow-brutal-sm hover:bg-red-200"
      >
        Elimina Campionato
      </Button>
    )
  }

  return (
    <div className="bg-red-50 border-[2px] border-red-500 p-3 flex flex-col gap-2 mt-4">
      <div className="flex justify-between items-start">
        <p className="text-sm font-bold text-red-600">Elimina questo campionato definitivamente. (Azione irreversibile!)</p>
        <button onClick={() => setIsExpanded(false)} className="text-red-500 font-bold px-2 py-1 border-[2px] border-red-500 hover:bg-red-100">X</button>
      </div>
      <label className="text-xs font-bold">Digita "Conferma" per sbloccare il bottone:</label>
      <Input 
        value={confirmText} 
        onChange={(e) => setConfirmText(e.target.value)} 
        placeholder="Conferma" 
        className="h-8 text-sm"
      />
      <form action={async () => {
        if (isConfirmed) {
          await deleteLeague(leagueId)
        }
      }}>
        <Button variant="destructive" type="submit" disabled={!isConfirmed} className="w-full h-8 text-sm">
          Elimina Campionato
        </Button>
      </form>
    </div>
  )
}
