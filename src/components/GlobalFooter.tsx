"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

export default function GlobalFooter() {
  const [lang, setLang] = useState<"it" | "en">("it")

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (navigator.language.startsWith("en")) {
        setLang("en")
      }
    }
  }, [])

  const resetConsent = (e: React.MouseEvent) => {
    e.preventDefault()
    localStorage.removeItem("volleybet_cookie_consent")
    window.dispatchEvent(new Event("reset_cookie_consent"))
  }

  return (
    <footer className="w-full bg-secondary border-t-[4px] border-black p-4 mt-auto">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm font-bold text-gray-800">
        <p>© {new Date().getFullYear()} VolleyBet</p>
        <div className="flex gap-6">
          <Link href="/privacy" className="hover:text-primary transition-colors underline decoration-[2px]">
            {lang === "it" ? "Privacy & Cookie Policy" : "Privacy & Cookie Policy"}
          </Link>
          <a href="#" onClick={resetConsent} className="hover:text-primary transition-colors underline decoration-[2px]">
            {lang === "it" ? "Gestisci Consenso" : "Manage Consent"}
          </a>
        </div>
      </div>
    </footer>
  )
}
