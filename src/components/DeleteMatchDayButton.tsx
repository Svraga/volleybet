"use client"

import { Button } from "@/components/ui/Button"
import { deleteMatchDay } from "@/actions/matchday"
import { Trash2 } from "lucide-react"

export default function DeleteMatchDayButton({ leagueId, matchDayId }: { leagueId: string, matchDayId: string }) {
  const handleDelete = async () => {
    if (window.confirm("Sei sicuro? Questa azione è irreversibile e cancellerà tutte le scommesse associate.")) {
      await deleteMatchDay(leagueId, matchDayId)
    }
  }

  return (
    <Button onClick={handleDelete} variant="destructive" className="h-8 flex items-center gap-2 text-xs">
      <Trash2 className="w-4 h-4" /> Elimina Giornata
    </Button>
  )
}
