"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { deleteLeague } from "@/actions/league"

export default function DeleteLeagueForm({ leagueId, leagueName }: { leagueId: string, leagueName: string }) {
  const [confirmText, setConfirmText] = useState("")
  const isConfirmed = confirmText === "Conferma"

  return (
    <div className="bg-red-50 border-[2px] border-red-500 p-3 flex flex-col gap-2 mt-4">
      <p className="text-sm font-bold text-red-600">Elimina questo campionato definitivamente. (Azione irreversibile!)</p>
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
