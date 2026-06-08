"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export default function GlobalFooter() {
  const pathname = usePathname()
  const [lang, setLang] = useState<"it" | "en">("it")

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (navigator.language.startsWith("en")) {
        setLang("en")
      }
    }
  }, [])

  if (pathname?.startsWith("/league")) {
    return null
  }

  const hasBottomNav = pathname === "/profile"
  const paddingClass = hasBottomNav ? "pb-20 md:pb-4" : "pb-4"

  return (
    <footer className={`w-full bg-secondary border-t-[4px] border-black p-4 ${paddingClass} mt-auto relative z-40`}>
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm font-bold text-gray-800">
        <p>VolleyBet</p>
        <div className="flex gap-6">
          <Link href="/terms" className="hover:text-primary transition-colors underline decoration-[2px]">
            {lang === "it" ? "Termini e Condizioni" : "Terms & Conditions"}
          </Link>
          <Link href="/privacy" className="hover:text-primary transition-colors underline decoration-[2px]">
            {lang === "it" ? "Privacy Policy" : "Privacy Policy"}
          </Link>
        </div>
      </div>
    </footer>
  )
}
