"use client"

import { Input } from "@/components/ui/Input"
import { brutalAlert } from "@/store/alertStore"
import { updateLeagueName } from "@/actions/league"
import { useState } from "react"
import SubmitButton from "@/components/SubmitButton"

export default function UpdateLeagueNameForm({ leagueId, defaultName }: { leagueId: string, defaultName: string }) {
  const [val, setVal] = useState(defaultName)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value.length > 15) {
      brutalAlert("Il massimo numero di caratteri per il nome del campionato è 15.")
      return
    }
    setVal(e.target.value)
  }

  const action = async (formData: FormData) => {
    if (val.trim().length === 0) {
      brutalAlert("Il nome del campionato è obbligatorio.")
      return
    }
    if (val.trim().length > 15) {
      brutalAlert("Il massimo numero di caratteri per il nome del campionato è 15.")
      return
    }
    try {
      await updateLeagueName(leagueId, formData)
    } catch (e: any) {
      brutalAlert(e.message || "Errore durante l'aggiornamento.")
    }
  }

  return (
    <form action={action} className="space-y-2">
      <label className="font-bold text-sm">Nome Campionato ({defaultName})</label>
      <div className="flex gap-2">
        <Input name="leagueName" value={val} onChange={handleChange} className="flex-1 text-sm h-8" />
        <SubmitButton variant="primary" className="h-8" defaultText="Aggiorna" loadingText="..." />
      </div>
    </form>
  )
}
