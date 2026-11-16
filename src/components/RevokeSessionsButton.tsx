"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { revokeAllSessions } from "@/actions/user"
import { Button } from "@/components/ui/Button"
import SubmitButton from "@/components/SubmitButton"

export default function RevokeSessionsButton() {
  const [confirming, setConfirming] = useState(false)
  return <div className="mt-5 border-t-[2px] border-black pt-4">
    {confirming ? <form action={async () => { await revokeAllSessions(); await signOut({ callbackUrl: "/" }) }} className="space-y-3">
      <p className="text-sm font-bold">Dovrai accedere di nuovo su questo dispositivo e sugli altri. I dati del profilo e le giocate restano salvati.</p>
      <SubmitButton defaultText="Conferma e disconnetti" variant="destructive" className="w-full text-sm" />
      <Button type="button" variant="outline" onClick={() => setConfirming(false)}>Annulla</Button>
    </form> : <Button type="button" variant="outline" className="w-full text-sm" onClick={() => setConfirming(true)}>Esci da tutti i dispositivi</Button>}
  </div>
}
