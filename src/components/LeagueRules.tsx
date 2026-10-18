"use client"

import { useId, useRef } from "react"
import { ScrollText, X } from "lucide-react"

export default function LeagueRules({ coinName }: { coinName: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const sections = [
    { title: "Scommesse", text: `Partecipare a una giornata costa 1 ${coinName}, addebitato una sola volta quando salvi il primo pronostico. Puoi inserire o modificare le tue giocate dall’apertura fino alla scadenza, senza ulteriori costi. I risultati ammessi sono 3-0, 3-1, 3-2, 2-3, 1-3 e 0-3.` },
    { title: "Squadra di appartenenza", text: "Non puoi scommettere sulla partita della tua squadra. Se la tua squadra riposa, puoi pronosticare su tutte le partite della giornata. La squadra scelta all’iscrizione resta fissa anche se esci e rientri nella lega." },
    { title: "Punti e classifica", text: "Risultato esatto: 3 punti. Vincente corretta ma risultato diverso: 1 punto. Vincente sbagliata: 0 punti. La classifica punti somma i punti delle giornate calcolate. La classifica dei coin considera invece quote e premi: sono due classifiche distinte." },
    { title: "Premi e rimborsi", text: `Le quote della giornata formano il montepremi. Con un solo vincitore, il primo riceve il montepremi meno l’eventuale premio ai secondi. I secondi ricevono fino a 1 ${coinName} ciascuno, anche frazionato, solo con un montepremi di almeno 3 e lasciando al primo più della metà. Più primi a pari punti si dividono tutto in parti uguali. Se tutti i partecipanti ottengono 0 punti, le quote vengono rimborsate. I coin sono virtuali.` },
    { title: "Scadenze e trasparenza", text: "L’admin può programmare l’apertura o anticiparla con Apri subito. Alla chiusura i pronostici diventano visibili a tutti i membri nella pagina Pronostici e non sono più modificabili. Prima dei risultati i box sono neutri; dopo il calcolo: rosso = 0, giallo = 1, verde = 3 punti." },
    { title: "Amministrazione e correzioni", text: "L’admin prepara gli accoppiamenti prima del primo pronostico. Può inserire pronostici per un giocatore che non ha ancora giocato, soltanto a scommesse aperte. Dopo la scadenza inserisce i risultati ufficiali; eventuali correzioni ricalcolano punti e premi senza duplicarli. Le operazioni sono registrate nel log della lega." },
  ]
  return <>
    <button type="button" title="Regolamento della lega" aria-label="Apri il regolamento della lega" onClick={() => dialog.current?.showModal()} className="shrink-0 border-[3px] border-black bg-yellow-300 p-2.5 shadow-brutal hover:bg-yellow-200 active:translate-y-px active:shadow-none">
      <ScrollText className="h-6 w-6" aria-hidden="true" />
    </button>
    <dialog ref={dialog} aria-labelledby={titleId} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto border-[4px] border-black bg-primary p-0 text-black shadow-brutal-lg backdrop:bg-black/60" onClick={e => { if (e.target === e.currentTarget) dialog.current?.close() }}>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b-[3px] border-black bg-yellow-300 p-4">
        <h2 id={titleId} className="flex items-center gap-2 text-xl font-black uppercase"><ScrollText aria-hidden="true" /> Regolamento</h2>
        <button type="button" autoFocus aria-label="Chiudi regolamento" onClick={() => dialog.current?.close()} className="border-[2px] border-black bg-white p-1 shadow-brutal-sm"><X aria-hidden="true" /></button>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm font-bold">Tutte le regole della tua lega, a portata di mano.</p>
        {sections.map((section, index) => <details key={section.title} open={index === 0} className="group border-[3px] border-black bg-white shadow-brutal">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 font-black uppercase text-sm"><span>{section.title}</span><span aria-hidden="true" className="group-open:rotate-45">+</span></summary>
          <p className="border-t-[2px] border-black p-3 text-sm font-medium leading-relaxed">{section.text}</p>
        </details>)}
      </div>
    </dialog>
  </>
}
