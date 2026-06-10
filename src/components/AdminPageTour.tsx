"use client"

import { useEffect, useState } from "react"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { useAlertStore } from "@/store/alertStore"

export default function AdminPageTour({ hasMatchdays }: { hasMatchdays?: boolean }) {
  const [showDummy, setShowDummy] = useState(false)

  useEffect(() => {
    // Check if the dashboard admin tour is done
    const isDashboardDone = localStorage.getItem("volleybet_admin_tour_done") === "true"
    const isPageTourDone = localStorage.getItem("volleybet_admin_page_tour_done") === "true"
    const forceTour = localStorage.getItem("volleybet_force_tour") === "true"
    
    if (!isDashboardDone) return
    if (isPageTourDone && !forceTour) return

    if (!hasMatchdays) {
      setShowDummy(true)
    }

    const tourDriver = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      allowKeyboardControl: true,
      popoverClass: 'brutal-tour-popover',
      onDestroyStarted: () => {
        if (!tourDriver.hasNextStep()) {
          tourDriver.destroy()
          localStorage.setItem("volleybet_admin_page_tour_done", "true")
          if (forceTour) localStorage.removeItem("volleybet_force_tour")
          setShowDummy(false)
        } else {
          useAlertStore.getState().showConfirm("Sei sicuro di voler saltare il tutorial?", () => {
            tourDriver.destroy()
            localStorage.setItem("volleybet_admin_page_tour_done", "true")
            if (forceTour) localStorage.removeItem("volleybet_force_tour")
            setShowDummy(false)
          })
        }
      }
    })

    const steps: any[] = [
      { element: '#tour-admin-new-matchday', popover: { title: 'Crea Giornata', description: 'Qui generi un nuovo blocco di scommesse, indicando il numero della giornata e la scadenza.', side: "bottom", align: 'start' } },
      { element: '#tour-admin-matchday-list', popover: { title: 'Gestione Turni', description: 'Qui vedi tutte le giornate. Clicca su una giornata per espanderla e rivelare i 3 pannelli di amministrazione.', side: "top", align: 'start' } },
      { popover: { title: 'Tutto Pronto!', description: 'Ricorda che una volta compilati i risultati, le scommesse verranno calcolate in automatico!' } }
    ]

    const timeoutId = setTimeout(() => {
      tourDriver.setSteps(steps)
      tourDriver.drive()
    }, 500)

    return () => {
      clearTimeout(timeoutId)
      tourDriver.destroy()
    }
  }, [hasMatchdays])

  if (!showDummy) return null

  return (
    <div className="fixed inset-0 z-50 bg-secondary overflow-y-auto p-6 flex flex-col items-center pt-12">
      <div className="w-full max-w-4xl mb-8 text-center bg-white border-[4px] border-black shadow-brutal p-4 -rotate-1">
        <h1 className="text-3xl font-black uppercase">Ambiente di Prova (Tutorial)</h1>
        <p className="font-bold text-gray-600">Essendo la tua prima volta (e non avendo turni creati), ecco un'anteprima di come sarà la Dashboard Admin!</p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 w-full max-w-4xl">
        <div id="tour-admin-new-matchday" className="md:col-span-1 space-y-8">
          <div className="bg-white overflow-hidden border-[3px] border-black shadow-brutal">
            <div className="flex justify-between items-center bg-primary text-black font-bold p-4">
              <span className="text-xl">➕ Nuova Giornata</span>
              <span>▼</span>
            </div>
            <div className="p-4 border-t-[3px] border-black bg-white space-y-4">
              <div className="h-10 bg-gray-200 border-[2px] border-black rounded" />
              <div className="h-10 bg-gray-200 border-[2px] border-black rounded" />
              <div className="h-12 bg-green-400 border-[2px] border-black rounded mt-4" />
            </div>
          </div>
        </div>

        <div id="tour-admin-matchday-list" className="md:col-span-2 space-y-8">
          <div className="bg-white overflow-hidden border-[3px] border-black shadow-brutal">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b-[3px] border-black bg-gray-100">
              <div className="flex items-center gap-4">
                <h3 className="text-2xl font-black tracking-tight">Giornata 1</h3>
                <span className="font-bold px-3 py-1 border-[2px] border-black text-sm bg-green-400">OPEN</span>
              </div>
            </div>
            <div className="p-6 space-y-4">
               <div className="h-20 bg-gray-200 border-[2px] border-black rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
