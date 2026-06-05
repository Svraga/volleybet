"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { createLeague } from "@/actions/league"
import Link from "next/link"
import { useState, useRef } from "react"

export default function CreateLeaguePage() {
  const [step, setStep] = useState(1)
  const [leagueName, setLeagueName] = useState("")
  const [homeTeam, setHomeTeam] = useState("")
  const [teams, setTeams] = useState<string[]>(["", ""])
  const [coinName, setCoinName] = useState("Coin")
  const formRef = useRef<HTMLFormElement>(null)

  const handleAddTeam = () => setTeams([...teams, ""])
  const handleTeamChange = (index: number, value: string) => {
    const newTeams = [...teams]
    newTeams[index] = value
    setTeams(newTeams)
  }
  const handleRemoveTeam = (index: number) => setTeams(teams.filter((_, i) => i !== index))

  const autoFillTest = () => {
    setLeagueName("Lega Test Sandbox")
    setHomeTeam("TestAdmin Volley")
    setTeams([
      "TestAdmin Volley",
      "Spikers Milano",
      "Blockers Roma",
      "Libero Napoli",
      "Ace Torino",
      "Dig Firenze",
      "Setters Venezia",
      "Jumpers Bologna"
    ])
    setCoinName("VolleyCoin")
    setStep(4)
  }

  const nextStep = () => {
    if (step === 1 && !leagueName.trim()) return alert("Inserisci un nome per il campionato.")
    if (step === 2 && !homeTeam.trim()) return alert("Inserisci il nome della tua squadra.")
    if (step === 3 && teams.some(t => !t.trim())) return alert("Compila tutti i campi delle squadre o rimuovi quelli vuoti.")
    if (step === 3 && !teams.includes(homeTeam)) return alert("Attenzione: la tua squadra deve essere presente nella lista!")
    setStep(s => s + 1)
  }
  const prevStep = () => setStep(s => s - 1)

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-primary pt-12 overflow-x-hidden">
      <div className="w-full max-w-2xl mb-8 flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-4xl font-bold uppercase bg-white border-[4px] border-black shadow-brutal px-4 py-2 inline-block -rotate-1">
          Crea Campionato
        </h1>
        <div className="flex gap-4">
          <Button type="button" onClick={autoFillTest} variant="primary" className="bg-yellow-300 hover:bg-yellow-400">
            🧪 Autocompila
          </Button>
          <Link href="/">
            <Button variant="outline">Annulla</Button>
          </Link>
        </div>
      </div>

      <Card className="w-full max-w-2xl bg-white border-[4px] border-black shadow-brutal transition-all">
        <form ref={formRef} action={createLeague}>
          <CardHeader className="bg-secondary border-b-[3px] border-black flex flex-row items-center justify-between">
            <CardTitle>Passo {step} di 4</CardTitle>
            <div className="font-bold bg-white px-3 py-1 border-[2px] border-black text-sm">
              {step === 1 && "Nome Campionato"}
              {step === 3 && "Le Squadre"}
              {step === 4 && "La Valuta"}
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className={step === 1 ? "space-y-4 animate-in fade-in slide-in-from-right-4 duration-300" : "hidden"}>
              <p className="text-xl font-bold text-gray-700">Come vuoi chiamare questo campionato?</p>
              <Input name="name" value={leagueName} onChange={e => setLeagueName(e.target.value)} required={step === 1} className="text-2xl h-16" />
            </div>

            <div className={step === 2 ? "space-y-4 animate-in fade-in slide-in-from-right-4 duration-300" : "hidden"}>
              <p className="text-xl font-bold text-gray-700">Qual è il nome della TUA squadra?</p>
              <p className="font-bold text-gray-500 text-sm">Nessun membro potrà scommettere sulle partite in cui gioca la propria squadra per evitare gufate pericolose.</p>
              <Input name="homeTeam" value={homeTeam} onChange={e => setHomeTeam(e.target.value)} required={step === 2} className="text-2xl h-16" />
            </div>

            <div className={step === 3 ? "space-y-4 animate-in fade-in slide-in-from-right-4 duration-300" : "hidden"}>
              <p className="text-xl font-bold text-gray-700">Quali squadre partecipano al girone?</p>
              <p className="font-bold text-gray-500 text-sm">Inserisci tutte le squadre avversarie. Ricordati che la TUA squadra deve essere presente in questa lista.</p>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto p-2 border-[2px] border-black bg-gray-50">
                {teams.map((t, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <Input 
                      name="teams[]" 
                      value={t} 
                      onChange={e => handleTeamChange(idx, e.target.value)} 
                      placeholder={`Squadra ${idx + 1}`}
                      required={step === 3} 
                      className="h-12"
                    />
                    {teams.length > 2 && (
                      <Button type="button" variant="outline" onClick={() => handleRemoveTeam(idx)} className="h-12 w-12 text-xl font-bold text-red-600">X</Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={handleAddTeam} className="w-full mt-2 border-dashed border-[3px] h-12 text-lg">
                  ➕ Aggiungi Squadra
                </Button>
              </div>
            </div>

            <div className={step === 4 ? "space-y-4 animate-in fade-in slide-in-from-right-4 duration-300" : "hidden"}>
              <p className="text-xl font-bold text-gray-700">Scegli il nome della tua valuta</p>
              <p className="font-bold text-gray-500 text-sm">I giocatori useranno questi gettoni virtuali per scommettere. Puoi chiamarli Coin, Birre, Fich, o come preferisci.</p>
              <Input name="coinName" value={coinName} onChange={e => setCoinName(e.target.value)} placeholder="es. Birre" required={step === 4} className="text-2xl h-16" />
            </div>

            <div className="pt-6 flex gap-4">
              {step > 1 && (
                <Button type="button" variant="secondary" onClick={prevStep} className="flex-1 h-14 text-xl">
                  Indietro
                </Button>
              )}
              {step < 4 ? (
                <Button type="button" variant="primary" onClick={nextStep} className="flex-1 h-14 text-xl bg-blue-500 text-white hover:bg-blue-600 border-black border-[3px] shadow-brutal">
                  Avanti
                </Button>
              ) : (
                <Button type="submit" variant="primary" className="flex-1 h-14 text-xl bg-green-500 text-white hover:bg-green-600 border-black border-[3px] shadow-brutal">
                  Genera
                </Button>
              )}
            </div>
          </CardContent>
        </form>
      </Card>
    </main>
  )
}
