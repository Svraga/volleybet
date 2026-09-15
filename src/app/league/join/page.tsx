"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { joinLeague, getLeaguePreview } from "@/actions/league"
import Link from "next/link"
import { useActionState, useState } from "react"
import { ArrowLeft, CheckCircle2, Trophy } from "lucide-react"

export default function JoinLeaguePage() {
  const [state, formAction, isPending] = useActionState(joinLeague, { error: null } as any)
  const [inviteCode, setInviteCode] = useState("")
  const [checkingCode, setCheckingCode] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [leagueData, setLeagueData] = useState<{ id: string; name: string; teams: string[] } | null>(null)
  const [selectedTeam, setSelectedTeam] = useState("")

  const handleCheckCode = async () => {
    if (!inviteCode.trim()) {
      setPreviewError("Inserisci un codice invito valido.")
      return
    }
    setCheckingCode(true)
    setPreviewError(null)
    try {
      const res = await getLeaguePreview(inviteCode)
      if (res.error) {
        setPreviewError(res.error)
        setLeagueData(null)
      } else if (res.name && res.teams) {
        setLeagueData(res as any)
        setSelectedTeam("")
      }
    } catch {
      setPreviewError("Errore durante la verifica del codice.")
    } finally {
      setCheckingCode(false)
    }
  }

  const handleReset = () => {
    setLeagueData(null)
    setSelectedTeam("")
    setPreviewError(null)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-secondary">
      <div className="absolute top-6 left-6">
        <Link href="/">
          <Button variant="outline" className="bg-white flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Indietro
          </Button>
        </Link>
      </div>

      <Card className="w-full max-w-md bg-white border-[4px] border-black shadow-brutal">
        <CardHeader className="bg-primary border-b-[3px] border-black">
          <CardTitle className="text-center text-3xl uppercase font-black tracking-wider text-black">
            Unisciti al Campionato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {!leagueData ? (
            // Passo 1: Inserisci il codice
            <div className="space-y-4">
              <div className="space-y-2 text-center">
                <label className="font-bold text-lg block">Codice Invito Lega</label>
                <Input 
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value.toUpperCase())
                    setPreviewError(null)
                  }}
                  placeholder="es. VOLLEY-ABCD1234" 
                  className="text-center text-xl uppercase font-mono tracking-widest h-14"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleCheckCode()
                    }
                  }}
                />
                {previewError && (
                  <p className="text-red-600 font-bold mt-2 bg-red-100 border-[2px] border-red-600 p-2 text-sm">
                    {previewError}
                  </p>
                )}
              </div>

              <Button 
                type="button" 
                variant="primary" 
                onClick={handleCheckCode}
                disabled={checkingCode || !inviteCode.trim()} 
                className="w-full text-xl h-14 uppercase font-black tracking-wider"
              >
                {checkingCode ? "Verifica in corso..." : "Verifica Codice →"}
              </Button>
            </div>
          ) : (
            // Passo 2: Seleziona la squadra
            <form action={formAction} className="space-y-6">
              <input type="hidden" name="inviteCode" value={inviteCode} />

              <div className="bg-yellow-100 border-[3px] border-black p-4 space-y-2 text-center shadow-brutal-sm">
                <div className="flex items-center justify-center gap-2 font-black text-xs uppercase text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-600" /> Campionato Trovato
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight text-black">
                  {leagueData.name}
                </h3>
              </div>

              <div className="space-y-2">
                <label className="font-black text-sm uppercase block text-gray-700">
                  Qual è la tua squadra in questo campionato?
                </label>
                <p className="text-xs font-bold text-gray-500 mb-2">
                  La partita in cui gioca la tua squadra verrà esclusa dai tuoi pronostici per correttezza sportiva.
                </p>
                <select 
                  name="teamName"
                  required
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full h-12 border-[3px] border-black px-3 font-bold bg-white text-base focus:outline-none focus:shadow-brutal-sm"
                >
                  <option value="" disabled>-- Seleziona la tua squadra --</option>
                  {leagueData.teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {state?.error && (
                <p className="text-red-600 font-bold bg-red-100 border-[2px] border-red-600 p-2 text-sm">
                  {state.error}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <Button 
                  type="submit" 
                  variant="primary" 
                  disabled={isPending || !selectedTeam} 
                  className="w-full text-xl h-14 uppercase font-black tracking-wider bg-green-500 hover:bg-green-600 text-white"
                >
                  {isPending ? "Iscrizione..." : "Entra nel Campionato"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleReset}
                  className="w-full text-xs font-bold"
                >
                  Cambia Codice
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
