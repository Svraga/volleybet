"use client"

import { Input } from "@/components/ui/Input"
import { brutalAlert } from "@/store/alertStore"
import { updateCoinName } from "@/actions/league"
import { useState } from "react"
import SubmitButton from "@/components/SubmitButton"

export default function UpdateCoinForm({ leagueId, defaultName }: { leagueId: string, defaultName: string }) {
  const [val, setVal] = useState(defaultName)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVal(e.target.value)
  }

  const action = async (formData: FormData) => {
    if (val.trim().length === 0) {
      brutalAlert("Il nome della valuta è obbligatorio.")
      return
    }
    if (val.trim().length > 15) {
      brutalAlert("Il massimo numero di caratteri per la valuta è 15.")
      return
    }
    try {
      await updateCoinName(leagueId, formData)
      brutalAlert("Valuta aggiornata con successo!")
    } catch (e: any) {
      brutalAlert(e.message || "Errore durante l'aggiornamento.")
    }
  }

  return (
    <form action={action} className="space-y-2">
      <label className="font-bold text-sm">Nome Coin ({defaultName})</label>
      <div className="flex gap-2">
        <Input name="coinName" value={val} onChange={handleChange} className="flex-1 text-sm h-8" />
        <SubmitButton variant="primary" className="h-8" defaultText="Aggiorna" loadingText="..." />
      </div>
    </form>
  )
}
