"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { deleteMatchDay } from "@/actions/matchday"
import { Trash2 } from "lucide-react"
import SubmitButton from "@/components/SubmitButton"
import { useAlertStore } from "@/store/alertStore"

export default function DeleteMatchDayButton({ leagueId, matchDayId }: { leagueId: string, matchDayId: string }) {
  const [isConfirming, setIsConfirming] = useState(false)
  const showAlert = useAlertStore(s => s.showAlert)

  if (!isConfirming) {
    return (
      <Button onClick={() => setIsConfirming(true)} variant="destructive" className="h-8 flex items-center gap-2 text-xs">
        <Trash2 className="w-4 h-4" /> Elimina Giornata
      </Button>
    )
  }

  const handleAction = async () => {
    try {
      await deleteMatchDay(leagueId, matchDayId)
    } catch (e: any) {
      showAlert(e.message || "Errore durante l'eliminazione.")
      setIsConfirming(false)
    }
  }

  return (
    <div className="flex gap-2 items-center bg-red-100 p-2 border-[2px] border-red-500 rounded-brutal-sm">
      <span className="text-xs font-bold text-red-700">Sei sicuro?</span>
      <form action={handleAction}>
        <SubmitButton variant="destructive" className="h-8 text-xs px-2" defaultText="Sì, elimina" loadingText="ELIMINANDO..." />
      </form>
      <Button onClick={() => setIsConfirming(false)} variant="outline" className="h-8 text-xs px-2">Annulla</Button>
    </div>
  )
}
