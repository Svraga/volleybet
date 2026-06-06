"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"

export default function PrivacyPage() {
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
            Privacy & Cookie Policy
          </h1>

          {lang === "it" ? (
            <div className="space-y-6 text-lg font-medium text-gray-800">
              <p>Ultimo aggiornamento: Giugno 2026</p>
              
              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">Titolare del Trattamento</h2>
                <p><strong>Amministratore di VolleyBet</strong> (Email per richieste privacy: daniele.sarcina@gmail.com)</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">Dati Raccolti</h2>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Dati di registrazione:</strong> Nome, Cognome, Email e immagine del profilo trasmessi tramite Google OAuth.</li>
                  <li><strong>Dati generati dall'utente:</strong> Storico delle scommesse/pronostici effettuati, leghe a cui si è iscritti e bilancio dei gettoni virtuali.</li>
                </ul>
                <p className="text-sm mt-2"><em>Nota: Il sito utilizza esclusivamente gettoni virtuali gratuiti senza alcun valore economico. Non ci sono transazioni con denaro reale.</em></p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">Finalità e Base Giuridica</h2>
                <p>I dati vengono trattati esclusivamente per:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Garantire l'autenticazione e la sicurezza dell'account.</li>
                  <li>Permettere la partecipazione alle leghe e il calcolo dei punteggi.</li>
                </ul>
                <p className="mt-2"><strong>Base giuridica:</strong> Esecuzione del contratto/termini di servizio per l'utilizzo della piattaforma.</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">Cookie e Local Storage</h2>
                <p>Questo sito non utilizza cookie di profilazione, Google Analytics o altri strumenti di tracciamento terzi.</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li><strong>Cookie tecnici:</strong> Utilizzati esclusivamente da NextAuth per mantenere la sessione di login attiva.</li>
                  <li><strong>Local Storage:</strong> Utilizzato dal browser per memorizzare le preferenze di interfaccia (es. completamento del tutorial iniziale e chiusura del banner cookie).</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">Conservazione dei Dati</h2>
                <p>I dati personali vengono conservati per tutto il tempo in cui l'account rimane attivo. In caso di richiesta di cancellazione, tutti i dati associati all'utente (inclusi pronostici e storico) verranno rimossi in modo permanente dai nostri server.</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">Diritti dell'Utente</h2>
                <p>Secondo il GDPR, hai il diritto di:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Accedere ai tuoi dati personali.</li>
                  <li>Chiedere la rettifica di dati inesatti.</li>
                  <li>Richiedere la cancellazione completa del tuo account e dei tuoi dati (Diritto all'oblio).</li>
                  <li>Richiedere la portabilità dei dati.</li>
                </ul>
                <p className="mt-2">Per esercitare i tuoi diritti, contattaci all'email indicata sopra.</p>
              </section>
            </div>
          ) : (
            <div className="space-y-6 text-lg font-medium text-gray-800">
              <p>Last updated: June 2026</p>
              
              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">Data Controller</h2>
                <p><strong>VolleyBet Administrator</strong> (Privacy requests Email: daniele.sarcina@gmail.com)</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">Data Collected</h2>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Registration data:</strong> First name, last name, email, and profile picture provided by Google OAuth.</li>
                  <li><strong>User-generated data:</strong> History of bets/predictions made, joined leagues, and virtual coin balance.</li>
                </ul>
                <p className="text-sm mt-2"><em>Note: The site strictly uses free virtual coins with no monetary value. There are no real money transactions.</em></p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">Purposes & Legal Basis</h2>
                <p>Data is processed exclusively to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Ensure account authentication and security.</li>
                  <li>Allow participation in leagues and score calculation.</li>
                </ul>
                <p className="mt-2"><strong>Legal basis:</strong> Execution of the contract/terms of service for using the platform.</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">Cookies & Local Storage</h2>
                <p>This site does not use profiling cookies, Google Analytics, or other third-party tracking tools.</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li><strong>Technical cookies:</strong> Exclusively used by NextAuth to maintain the active login session.</li>
                  <li><strong>Local Storage:</strong> Used by the browser to store interface preferences (e.g., completion of the initial tutorial and cookie banner dismissal).</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">Data Retention</h2>
                <p>Personal data is kept for as long as your account remains active. Upon request for account deletion, all data associated with the user (including predictions and history) will be permanently removed from our servers.</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-2xl font-bold uppercase border-b-[3px] border-black inline-block">User Rights</h2>
                <p>Under the GDPR, you have the right to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Access your personal data.</li>
                  <li>Request correction of inaccurate data.</li>
                  <li>Request complete deletion of your account and data (Right to be forgotten).</li>
                  <li>Request data portability.</li>
                </ul>
                <p className="mt-2">To exercise your rights, please contact us at the email provided above.</p>
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
