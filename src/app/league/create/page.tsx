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
  const [numTeams, setNumTeams] = useState(4)
  const [teams, setTeams] = useState<string[]>(Array(4).fill(""))
  const [coinName, setCoinName] = useState("Coin")
  const formRef = useRef<HTMLFormElement>(null)

  const handleNumTeamsChange = (n: number) => {
    setNumTeams(n)
    setTeams(prev => {
      const newTeams = [...prev]
      if (n > prev.length) {
        return [...newTeams, ...Array(n - prev.length).fill("")]
      } else {
        return newTeams.slice(0, n)
      }
    })
  }

  const handleTeamChange = (index: number, value: string) => {
    const newTeams = [...teams]
    newTeams[index] = value
    setTeams(newTeams)
    // Se la squadra home viene rinominata, aggiorniamo (selezioniamo per index invece che per stringa per essere più robusti, ma per ora teniamo la logica semplice)
  }

  const nextStep = () => {
    if (step === 1 && !leagueName.trim()) return alert("Inserisci un nome per il campionato.")
    if (step === 2) {
      // Nessuna validazione necessaria, select ha sempre un valore
    }
    if (step === 3) {
      if (teams.some(t => !t.trim())) return alert("Compila tutti i nomi delle squadre.")
      if (!homeTeam.trim()) return alert("Devi selezionare la tua squadra dal menu a tendina.")
      if (!teams.includes(homeTeam)) return alert("La tua squadra non è presente nella lista (errore di selezione).")
    }
    setStep(s => s + 1)
  }
  const prevStep = () => setStep(s => s - 1)

  const handleSubmit = (e: React.FormEvent) => {
    if (!coinName.trim()) {
      e.preventDefault()
      alert("Inserisci un nome per la valuta.")
      return
    }
    // Submit handled natively by action attribute on form
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-primary pt-12 overflow-x-hidden">
      <div className="w-full max-w-2xl mb-8 flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-4xl font-bold uppercase bg-white border-[4px] border-black shadow-brutal px-4 py-2 inline-block -rotate-1">
          Crea Campionato
        </h1>
        <div className="flex gap-4">
          <Link href="/">
            <Button variant="outline">Annulla</Button>
          </Link>
        </div>
      </div>

      <Card className="w-full max-w-2xl bg-white border-[4px] border-black shadow-brutal transition-all">
        <form ref={formRef} action={createLeague} onSubmit={handleSubmit}>
          <CardHeader className="bg-secondary border-b-[3px] border-black flex flex-row items-center justify-between gap-4">
            <CardTitle className="whitespace-nowrap">Passo {step} di 4</CardTitle>
            <div className="font-bold bg-white px-2 py-1 border-[2px] border-black text-xs md:text-sm whitespace-nowrap overflow-hidden text-ellipsis">
              {step === 1 && "Nome Campionato"}
              {step === 2 && "Numero di Squadre"}
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
              <p className="text-xl font-bold text-gray-700">Da quante squadre è composto il girone?</p>
              <p className="font-bold text-gray-500 text-sm">Seleziona il numero totale di squadre. {numTeams % 2 !== 0 ? "(Numero dispari: una squadra riposerà ad ogni turno)" : ""}</p>
              <select 
                className="flex h-16 w-full rounded-brutal border-[3px] border-black bg-white px-4 py-2 text-xl text-black shadow-brutal focus-visible:outline-none focus-visible:ring-0 focus-visible:border-black"
                value={numTeams}
                onChange={(e) => handleNumTeamsChange(parseInt(e.target.value))}
              >
                {Array.from({ length: 17 }, (_, i) => i + 4).map(n => (
                  <option key={n} value={n}>{n} Squadre</option>
                ))}
              </select>
              <input type="hidden" name="hasOddTeams" value={numTeams % 2 !== 0 ? "true" : "false"} />
            </div>

            <div className={step === 3 ? "space-y-4 animate-in fade-in slide-in-from-right-4 duration-300" : "hidden"}>
              <p className="text-xl font-bold text-gray-700">Chi partecipa al girone?</p>
              <p className="font-bold text-gray-500 text-sm">Inserisci i nomi di tutte le squadre. Poi seleziona la tua squadra reale in basso.</p>
              <div className="space-y-2 max-h-[30vh] overflow-y-auto p-2 border-[2px] border-black bg-gray-50">
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
                  </div>
                ))}
              </div>
              
              <div className="mt-6 space-y-2 p-4 bg-yellow-100 border-[3px] border-black">
                <p className="text-lg font-bold">Qual è la TUA squadra?</p>
                <p className="text-sm font-bold text-gray-600 mb-2">Non potrai scommettere sulle partite della tua squadra reale.</p>
                <select 
                  name="homeTeam"
                  className="flex h-12 w-full rounded-brutal border-[3px] border-black bg-white px-4 py-2 text-md text-black shadow-brutal focus-visible:outline-none"
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  required={step === 3}
                >
                  <option value="" disabled>-- Seleziona la tua squadra --</option>
                  {teams.filter(t => t.trim() !== "").map((t, idx) => (
                    <option key={idx} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={step === 4 ? "space-y-4 animate-in fade-in slide-in-from-right-4 duration-300" : "hidden"}>
              <p className="text-xl font-bold text-gray-700">Scegli il nome della tua valuta</p>
              <p className="font-bold text-gray-500 text-sm">I giocatori useranno questi gettoni virtuali per scommettere. Puoi chiamarli Coin, Birre, Fich, o come preferisci.</p>
              <Input name="coinName" value={coinName} onChange={e => setCoinName(e.target.value)} placeholder="es. Birre" required={step === 4} className="text-2xl h-16" />
            </div>

            <div className="pt-6 flex justify-center items-center gap-4 w-full max-w-sm mx-auto">
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
