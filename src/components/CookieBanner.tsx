"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { brutalAlert } from "@/store/alertStore"

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [lang, setLang] = useState<"it" | "en">("it")

  useEffect(() => {
    // Only run on client
    const hasAccepted = localStorage.getItem("volleybet_cookie_consent")
    if (!hasAccepted) {
      if (navigator.language.startsWith("en")) {
        setLang("en")
      }
      setShowBanner(true)
    }

    // Custom event listener for reopening the banner
    const handleReset = () => {
      if (navigator.language.startsWith("en")) {
        setLang("en")
      } else {
        setLang("it")
      }
      setShowBanner(true)
    }
    window.addEventListener("reset_cookie_consent", handleReset)
    return () => window.removeEventListener("reset_cookie_consent", handleReset)
  }, [])

  const handleAccept = () => {
    localStorage.setItem("volleybet_cookie_consent", "true")
    setShowBanner(false)
  }

  const handleDecline = () => {
    // Decline action as requested: refuse by closing or redirecting
    brutalAlert(lang === "it" ? "Per rifiutare i cookie, chiudi l'applicazione." : "To refuse cookies, please close the app.")
    // We can also clear storage or redirect
    window.location.href = "about:blank"
  }

  if (!showBanner) return null

  const texts = {
    it: {
      message: "VolleyBet utilizza cookie tecnici essenziali per consentire l'autenticazione tramite Google. Puoi accettare l'uso dei cookie o rifiutarli chiudendo l'app. Per maggiori dettagli, consulta la nostra",
      link: "Privacy & Cookie Policy",
      accept: "Accetta",
      decline: "Rifiuta"
    },
    en: {
      message: "VolleyBet uses essential technical cookies to allow authentication via Google. You can accept the use of cookies or refuse them by closing the app. For more details, please see our",
      link: "Privacy & Cookie Policy",
      accept: "Accept",
      decline: "Decline"
    }
  }

  const t = texts[lang]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white border-t-[4px] border-black p-4 md:p-6 shadow-[0_-4px_0_rgba(0,0,0,1)] flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-bottom-full duration-500">
      <p className="text-sm md:text-base font-bold text-gray-800 text-center md:text-left flex-1">
        {t.message} <Link href="/privacy" className="underline decoration-[3px] text-primary hover:text-black transition-colors">{t.link}</Link>.
      </p>
      <div className="flex flex-row w-full md:w-auto gap-4">
        <Button variant="primary" onClick={handleDecline} className="flex-1 md:flex-none uppercase font-black px-6 border-[3px] shadow-brutal-sm bg-white text-black hover:bg-gray-100">
          {t.decline}
        </Button>
        <Button variant="primary" onClick={handleAccept} className="flex-1 md:flex-none uppercase font-black px-6 border-[3px] shadow-brutal-sm bg-white text-black hover:bg-gray-100">
          {t.accept}
        </Button>
      </div>
    </div>
  )
}
