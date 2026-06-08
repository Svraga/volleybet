"use client"

import { useState } from "react"
import { Input } from "@/components/ui/Input"
import SubmitButton from "@/components/SubmitButton"
import { updateNickname } from "@/actions/user"
import { useAlertStore } from "@/store/alertStore"

export default function UpdateNicknameForm({ defaultName }: { defaultName: string }) {
  const showAlert = useAlertStore(s => s.showAlert)

  const handleAction = async (formData: FormData) => {
    const name = formData.get("nickname") as string
    if (name.trim().length < 2) {
      showAlert("Il nickname deve contenere almeno 2 caratteri.")
      return
    }
    if (name.length > 20) {
      showAlert("Il nickname non può superare i 20 caratteri. Sii più conciso!")
      return
    }
    
    try {
      await updateNickname(formData)
      showAlert("Nickname aggiornato con successo!")
    } catch (e: any) {
      showAlert(e.message || "Errore durante l'aggiornamento.")
    }
  }

  return (
    <form action={handleAction} className="space-y-4">
      <div className="space-y-2">
        <label className="font-bold">Nickname Visualizzato</label>
        <div className="flex gap-4">
          <Input name="nickname" defaultValue={defaultName} className="flex-1" />
          <SubmitButton variant="primary" defaultText="Salva" loadingText="..." />
        </div>
      </div>
    </form>
  )
}
