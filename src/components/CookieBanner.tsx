"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/Button"

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const hasAccepted = localStorage.getItem("volleybet_cookie_accepted")
    if (!hasAccepted) {
      setShowBanner(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem("volleybet_cookie_accepted", "true")
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white border-t-[4px] border-black p-4 shadow-[0_-4px_0_rgba(0,0,0,1)] flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-full duration-500">
      <p className="text-sm md:text-base font-bold text-gray-800 text-center md:text-left flex-1">
        Questo sito utilizza cookie tecnici essenziali per gestire l'autenticazione. Proseguendo la navigazione o effettuando il login, accetti la nostra <a href="#" className="underline decoration-[3px] text-primary hover:text-black transition-colors">Privacy & Cookie Policy</a>.
      </p>
      <Button variant="primary" onClick={handleAccept} className="w-full md:w-auto uppercase font-black px-8">
        Ho Capito
      </Button>
    </div>
  )
}
