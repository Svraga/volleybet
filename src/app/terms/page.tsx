"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"

export default function TermsPage() {
  const [lang, setLang] = useState<"it" | "en">("it")

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (navigator.language.startsWith("en")) {
        setLang("en")
      }
    }
  }, [])

  return (
    <main className="min-h-screen bg-primary p-6 md:p-12 pb-24">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white border-[4px] border-black p-4 shadow-brutal">
          <Link href="/">
            <Button variant="outline" className="font-bold">← Home</Button>
          </Link>
          <div className="flex gap-2">
            <Button 
              variant={lang === "it" ? "primary" : "outline"} 
              onClick={() => setLang("it")}
            >
              IT
            </Button>
            <Button 
              variant={lang === "en" ? "primary" : "outline"} 
              onClick={() => setLang("en")}
            >
              EN
            </Button>
          </div>
        </div>

        <div className="bg-white border-[4px] border-black p-6 md:p-10 shadow-brutal space-y-8">
          <h1 className="text-3xl md:text-5xl font-black uppercase text-center bg-yellow-300 inline-block px-4 py-2 border-[2px] border-black -rotate-1 mb-6">
            Termini e Condizioni / Terms
          </h1>

          {lang === "it" ? (
            <div className="space-y-6 text-lg font-medium text-gray-800">
              <p>Ultimo aggiornamento: Giugno 2026</p>
              
              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">1. Natura del Servizio</h2>
                <p>VolleyBet è una piattaforma gratuita di intrattenimento che permette agli utenti di partecipare a leghe di pronostici sportivi (fantavolley). Il servizio è fornito "così com'è" (as is) e per puro scopo ludico. <strong>Tutti i gettoni o "Coin" menzionati o utilizzati all'interno della piattaforma sono puramente virtuali, non hanno alcun valore monetario o reale e non possono essere scambiati, venduti o convertiti in denaro reale o premi fisici in nessuna circostanza.</strong></p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">2. Limiti d'Età</h2>
                <p>L'utilizzo di VolleyBet è consentito solo a utenti che abbiano compiuto almeno <strong>18 anni</strong> di età. Registrandosi tramite Google OAuth e utilizzando il servizio, l'utente dichiara e garantisce di essere maggiorenne.</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">3. Limitazione di Responsabilità</h2>
                <p>L'amministratore di VolleyBet non può essere ritenuto responsabile per:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Interruzioni del servizio, malfunzionamenti tecnici o perdita dei dati (inclusi pronostici, storico e punteggi delle leghe).</li>
                  <li>Danni diretti o indiretti derivanti dall'uso o dall'impossibilità di usare la piattaforma.</li>
                  <li>Contenuti generati dagli utenti (come i nomi delle leghe e delle squadre).</li>
                </ul>
                <p>L'utente utilizza la piattaforma a proprio rischio.</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">4. Comportamento dell'Utente e Ban</h2>
                <p>È severamente vietato l'uso di linguaggio offensivo, discriminatorio, o illegale nei nomi delle leghe, delle squadre o in eventuali altre interazioni. L'amministratore si riserva il diritto insindacabile di modificare o cancellare contenuti, nonché di sospendere o bannare definitivamente gli account degli utenti che violino queste regole o che tentino di manomettere il funzionamento della piattaforma.</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">5. Modifiche ai Termini</h2>
                <p>L'amministratore si riserva il diritto di modificare i presenti Termini e Condizioni in qualsiasi momento. Gli utenti saranno avvisati delle modifiche significative. L'uso continuato della piattaforma dopo tali modifiche costituisce accettazione dei nuovi Termini.</p>
              </section>
            </div>
          ) : (
            <div className="space-y-6 text-lg font-medium text-gray-800">
              <p>Last updated: June 2026</p>
              
              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">1. Nature of the Service</h2>
                <p>VolleyBet is a free entertainment platform that allows users to participate in sports prediction leagues (fantasy volleyball). The service is provided "as is" and purely for recreational purposes. <strong>All tokens or "Coins" mentioned or used within the platform are purely virtual, have no monetary or real-world value, and cannot be exchanged, sold, or converted into real money or physical prizes under any circumstances.</strong></p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">2. Age Restriction</h2>
                <p>The use of VolleyBet is restricted to users who are at least <strong>18 years old</strong>. By registering via Google OAuth and using the service, the user represents and warrants that they are of legal age.</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">3. Limitation of Liability</h2>
                <p>The administrator of VolleyBet cannot be held liable for:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Service interruptions, technical malfunctions, or data loss (including predictions, history, and league scores).</li>
                  <li>Direct or indirect damages arising from the use or inability to use the platform.</li>
                  <li>User-generated content (such as league and team names).</li>
                </ul>
                <p>The user uses the platform at their own risk.</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">4. User Conduct and Bans</h2>
                <p>The use of offensive, discriminatory, or illegal language in league names, team names, or any other interactions is strictly prohibited. The administrator reserves the sole right to modify or delete content, as well as to suspend or permanently ban the accounts of users who violate these rules or attempt to tamper with the platform's operation.</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">5. Changes to Terms</h2>
                <p>The administrator reserves the right to modify these Terms and Conditions at any time. Users will be notified of significant changes. Continued use of the platform after such modifications constitutes acceptance of the new Terms.</p>
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
