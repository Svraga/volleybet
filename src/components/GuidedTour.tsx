"use client"

import { useEffect } from "react"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { useTourStore } from "@/store/tour"
import { useAlertStore } from "@/store/alertStore"

export default function GuidedTour({ isAdmin }: { isAdmin: boolean }) {
  const { setTourActive } = useTourStore()
  useEffect(() => {
    // Check if we should force tour
    const forceTour = localStorage.getItem("volleybet_force_tour") === "true"
    const adminKey = "volleybet_admin_tour_done"
    const playerKey = "volleybet_player_tour_done"
    
    const isDone = isAdmin ? localStorage.getItem(adminKey) : localStorage.getItem(playerKey)

    if (isDone && !forceTour) return

    // Run tour
    const tourDriver = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      allowKeyboardControl: true,
      popoverClass: 'brutal-tour-popover',
      onDestroyStarted: () => {
        if (!tourDriver.hasNextStep()) {
          tourDriver.destroy();
          setTourActive(false);
          localStorage.setItem(isAdmin ? adminKey : playerKey, "true")
          if (forceTour) localStorage.removeItem("volleybet_force_tour")
        } else {
          useAlertStore.getState().showConfirm("Sei sicuro di voler saltare il tutorial?", () => {
            tourDriver.destroy();
            setTourActive(false);
            localStorage.setItem(isAdmin ? adminKey : playerKey, "true")
            if (forceTour) localStorage.removeItem("volleybet_force_tour")
          })
        }
      }
    });

    const playerSteps: any[] = [
      { element: '#tour-welcome', popover: { title: 'Benvenuto!', description: 'Benvenuto su VolleyBet! Ecco come sfidare la tua squadra.', side: "bottom", align: 'start' } },
      { element: '#tour-coin', popover: { title: 'I tuoi gettoni', description: 'Questo è il tuo wallet. Ogni giornata costa 1 Coin. Scommetti su tutti i match che vuoi, il costo non cambia!', side: "bottom", align: 'start' } },
      { element: '#tour-open-matchdays', popover: { title: 'Scommesse', description: 'Qui trovi i turni pronti per i tuoi pronostici. La partita in cui gioca la tua squadra reale è nascosta per correttezza.', side: "top", align: 'start' } },
      { element: '#tour-stats', popover: { title: 'Classifiche', description: 'Da qui tieni d\'occhio i punti e i coin guadagnati round-by-round.', side: "top", align: 'start' } }
    ]

    const adminSteps: any[] = [
      { element: '#tour-welcome', popover: { title: 'Benvenuto Admin!', description: 'Benvenuto nel tuo pannello di controllo. Qui gestisci tutta la lega.', side: "bottom", align: 'start' } },
      { element: '#tour-invite', popover: { title: 'Codice Invito', description: 'Questo è il codice del campionato. Copialo e passalo alla squadra per farli iscrivere.', side: "top", align: 'start' } },
      { element: '#tour-admin-button', popover: { title: 'Pannello Admin', description: 'Da qui crei le giornate. Clicca su \'Pannello Admin\' per accedere ai 3 pannelli di controllo: Gestione Partite, Inserimento Risultati e Logistica.', side: "bottom", align: 'start' } },
      { element: '#tour-admin-button', popover: { title: 'Proxy Bet', description: 'Nella sezione logistica vedi in tempo reale chi ha già scommesso e puoi inserire i pronostici per conto di chi non ha internet o si è dimenticato.', side: "bottom", align: 'start' } },
    ]

    tourDriver.setSteps(isAdmin ? adminSteps : playerSteps);
    
    // Slight delay to ensure elements are mounted
    const timeoutId = setTimeout(() => {
      setTourActive(true);
      tourDriver.drive();
    }, 500)

    return () => {
      clearTimeout(timeoutId)
      tourDriver.destroy()
      setTourActive(false);
    }
  }, [isAdmin])

  return null
}
