"use client"

import { useState } from "react"
import { Settings, X } from "lucide-react"
import UpdateLeagueNameForm from "@/components/UpdateLeagueNameForm"
import UpdateCoinForm from "@/components/UpdateCoinForm"

interface AdminHeaderProps {
  leagueId: string
  leagueName: string
  coinName: string
  hasEmptyMatchDays: boolean
}

export default function AdminHeader({ 
  leagueId, 
  leagueName, 
  coinName, 
  hasEmptyMatchDays 
}: AdminHeaderProps) {
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  return (
    <>
      <div className="flex justify-between items-center gap-4 w-full mb-8 flex-wrap">
        <h1 className="text-base md:text-lg font-black uppercase tracking-tight bg-white border-[3px] border-black shadow-brutal px-3 py-1.5 inline-block -rotate-1 truncate max-w-[calc(100%-60px)]">
          Admin - {leagueName}
        </h1>
        
        <div className="flex gap-3 items-center">
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="bg-yellow-300 hover:bg-yellow-400 text-black border-[3px] border-black p-1.5 font-bold uppercase text-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center justify-center rounded-brutal"
            title="Impostazioni Campionato"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border-[4px] border-black shadow-brutal p-6 max-w-md w-full space-y-6 transform -rotate-1 relative">
            <button 
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-2 right-2 p-1 border-[2px] border-black bg-red-400 text-white font-bold hover:bg-red-500 rounded-brutal shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <Settings className="w-7 h-7 text-yellow-500" />
              <h2 className="text-xl font-bold uppercase leading-tight">Impostazioni Campionato</h2>
            </div>
            <div className="space-y-4 border-t-[3px] border-black border-dashed pt-4 text-left">
              <UpdateLeagueNameForm leagueId={leagueId} defaultName={leagueName} />
              <UpdateCoinForm leagueId={leagueId} defaultName={coinName} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
