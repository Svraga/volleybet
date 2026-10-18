"use client"

import { useId, useState, useSyncExternalStore } from "react"
import { Input } from "@/components/ui/Input"
import SubmitButton from "@/components/SubmitButton"
import { Button } from "@/components/ui/Button"

function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function subscribeToMinute(onChange: () => void) {
  const timer = setInterval(onChange, 1000)
  return () => clearInterval(timer)
}
const currentMinute = () => Math.floor(Date.now() / 60000) * 60000
const serverMinute = () => 0

export default function MatchdayDateForm({ action, number, deadline, opensAt }: {
  action: (form: FormData) => Promise<void | { error: string }>
  number?: number
  deadline?: string
  opensAt?: string | null
}) {
  const id = useId()
  const [mode, setMode] = useState("now")
  const minute = useSyncExternalStore(subscribeToMinute, currentMinute, serverMinute)
  const minimum = minute ? localInput(new Date(minute)) : ""
  const [editedDeadline, setEditedDeadline] = useState<string | null>(null)
  const deadlineValue = editedDeadline ?? (minute && deadline ? localInput(new Date(deadline)) : "")
  const [openingValue, setOpeningValue] = useState("")
  const [error, setError] = useState("")

  async function submit(form: FormData) {
    setError("")
    const close = new Date(deadlineValue)
    const open = mode === "scheduled" && number !== undefined ? new Date(openingValue) : null
    if (!Number.isFinite(close.getTime()) || close.getTime() <= Date.now() || localInput(close) !== deadlineValue) {
      setError("La scadenza deve essere una data e un orario futuri."); return
    }
    if (open && (!Number.isFinite(open.getTime()) || open.getTime() <= Date.now() || localInput(open) !== openingValue)) {
      setError("L'apertura deve essere futura. Per aprire ora scegli Apri subito."); return
    }
    if ((open && open >= close) || (opensAt && close <= new Date(opensAt))) {
      setError("La scadenza deve essere successiva all'apertura."); return
    }
    form.set("deadline", close.toISOString())
    if (number !== undefined) {
      form.set("openingMode", mode)
      if (open) form.set("opensAt", open.toISOString())
    }
    const result = await action(form)
    if (result?.error) setError(result.error)
  }

  return (
    <form action={submit} className="space-y-4">
      {number !== undefined && <>
        <div className="space-y-2">
          <label htmlFor={`${id}-number`} className="font-bold">Numero giornata</label>
          <Input id={`${id}-number`} type="number" name="number" min={1} max={100000} defaultValue={number} required />
        </div>
        <fieldset className="space-y-2">
          <legend className="font-bold mb-2">Apertura scommesse</legend>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={mode === "now" ? "primary" : "outline"} aria-pressed={mode === "now"} onClick={() => setMode("now")} className="px-2 text-xs">Apri subito</Button>
            <Button type="button" variant={mode === "scheduled" ? "primary" : "outline"} aria-pressed={mode === "scheduled"} onClick={() => setMode("scheduled")} className="px-2 text-xs">Programma</Button>
          </div>
          {mode === "scheduled" ? <>
            <label htmlFor={`${id}-opening`} className="block text-sm font-bold">Data e ora di apertura</label>
            <Input id={`${id}-opening`} type="datetime-local" value={openingValue} onChange={e => setOpeningValue(e.target.value)} min={minimum} required />
          </> : <p className="text-xs font-bold text-gray-600">La giornata sarà aperta appena creata.</p>}
        </fieldset>
      </>}
      <div className="space-y-2">
        <label htmlFor={`${id}-deadline`} className="font-bold">Scadenza scommesse</label>
        <Input id={`${id}-deadline`} type="datetime-local" value={deadlineValue} onChange={e => setEditedDeadline(e.target.value)} min={openingValue && mode === "scheduled" && openingValue > minimum ? openingValue : minimum} required />
        <p className="text-xs font-bold text-gray-600">Gli orari seguono il fuso del tuo dispositivo.</p>
      </div>
      {error && <p role="alert" className="border-[2px] border-black bg-red-100 p-2 text-sm font-bold">{error}</p>}
      <SubmitButton variant="primary" className="w-full uppercase text-sm" defaultText={number !== undefined ? "Crea giornata" : "Aggiorna scadenza"} loadingText="SALVATAGGIO..." />
    </form>
  )
}
