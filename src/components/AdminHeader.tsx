"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Home, AlertTriangle } from "lucide-react"

export default function AdminHeader({ leagueId, hasEmptyMatchDays }: { leagueId: string, hasEmptyMatchDays: boolean }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

  const handleHomeClick = (e: React.MouseEvent) => {
    if (hasEmptyMatchDays) {
      e.preventDefault()
      setShowModal(true)
    } else {
      router.push(`/league/${leagueId}`)
    }
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight bg-white border-[4px] border-black shadow-brutal px-4 py-2 inline-block -rotate-1">
          Pannello Admin
        </h1>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border-[4px] border-black shadow-brutal p-6 max-w-sm w-full space-y-6 transform rotate-1">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-8 h-8" />
              <h2 className="text-xl font-bold uppercase leading-tight">Attenzione!</h2>
            </div>
            <p className="font-bold text-sm">
              Stai uscendo senza aver aggiunto partite a una o più giornate. Vuoi davvero procedere?
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 bg-white border-[3px] border-black p-2 font-bold uppercase text-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                Resta qui
              </button>
              <button 
                onClick={() => {
                  setShowModal(false)
                  router.push(`/league/${leagueId}`)
                }}
                className="flex-1 bg-red-500 text-white border-[3px] border-black p-2 font-bold uppercase text-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                Esci Comunque
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
