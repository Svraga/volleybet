# Audit di sicurezza VolleyBet

> Questo documento descrive lo stato precedente alle correzioni. Per gli interventi e le verifiche attuali consulta [SECURITY-FIXES.md](SECURITY-FIXES.md). I risultati originali delle riproduzioni sono conservati; il comando node audit/reproduce.cjs ora esegue i test di regressione del codice corretto.

Data di riferimento: **4 ottobre 2026**. Revisione: `e9761ef`, con le modifiche locali già presenti in `package.json` e `src/app/league/[id]/page.tsx` incluse nell'analisi.

Sono stati esaminati Server Actions, pagine e layout, componenti client, autenticazione NextAuth, middleware, schema e migrazioni Prisma, script, configurazioni, gestione locale dei segreti e dipendenze installate. Sono state consultate le guide della versione Next.js installata in `node_modules/next/dist/docs/`, in particolare `data-security.md`, `authentication.md` e `proxy.md`.

**Risultato:** 17 riscontri sotto elencati, inclusi problemi applicativi, un rischio operativo e vulnerabilità di dipendenza con condizioni esplicite. Una carenza aggiuntiva di autorizzazione richiede verifica HTTP. `npm audit` segnala **14 pacchetti e 34 avvisi distinti**; questi numeri non equivalgono a 14 o 34 exploit applicabili alla produzione.

Le gravità applicative sono qualitative. I crediti sono virtuali: i problemi di saldo e classifica sono rischi di integrità del gioco, senza implicare perdita di denaro reale. Le azioni già consentite all'amministratore sono segnalate quando aggirano limiti dichiarati nell'interfaccia o compromettono equità/trasparenza; non costituiscono automaticamente un'escalation di privilegi.

## Evidenze e limiti

- `node audit/reproduce.cjs`: **12 riproduzioni isolate completate**, eseguendo le funzioni TypeScript originali con sessioni e Prisma simulati. Nessuna connessione al database e nessun dato reale modificato. Per NextAuth viene chiamato il middleware effettivamente installato.
- Le prove di concorrenza controllano un ordine di esecuzione deterministico, con transazioni seriali e letture precedenti alle transazioni. Dimostrano il difetto applicativo; non sostituiscono un test d'integrazione PostgreSQL o la misura della probabilità di sfruttamento.
- `audit/reproduction-results.json` contiene i risultati. `audit/npm-audit.json` contiene la risposta integrale del registro npm. `audit/dependency-findings.md` elenca ogni avviso distinto, le versioni e le dipendenze coinvolte.
- Non sono stati eseguiti payload RCE, loop realmente infiniti, brute force di inviti o attacchi contro un servizio pubblicato. Non è stato eseguito lo script distruttivo `scripts/test-payouts.ts`.
- Non sono state verificate le impostazioni di produzione del provider, il sistema operativo del server, le policy del database, l'effettivo TLS della connessione DB o le regole di un eventuale WAF. Nessuna modifica al codice applicativo.
- L'audit copre le superfici disponibili nel repository; non garantisce l'assenza di altre vulnerabilità.

## Riscontri

### S01 — Critica, condizionata a hosting Windows: RCE senza autenticazione in Next.js

**Posizione:** `package.json:21`, `next.config.ts:3`. Versione installata: `next@16.2.7`.

L'avviso del produttore [GHSA-p293-qw3h-jr36 / CVE-2026-75604](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) riguarda App Router/Pages Router senza Cache Components, con filesystem Windows, nelle versioni 16.x precedenti a **16.3.3**. Questa applicazione usa App Router e non abilita Cache Components. Il workspace è su Windows: se il server viene eseguito qui, le condizioni software coincidono con quelle dell'avviso. Il sistema operativo della produzione non è noto. Nessuna esecuzione remota dimostrata con payload.

**Impatto:** esecuzione di codice con i privilegi del processo Next.js se il server vulnerabile è raggiungibile. **Rimedio:** aggiornare Next.js a una release stabile che includa almeno questa correzione e le successive correzioni applicabili; 16.3.3 corregge questo specifico avviso. Non basta 16.2.11.

### S02 — Alta: DoS senza autenticazione tramite Server Actions di Next.js

**Posizione:** `package.json:21`, tutti i moduli `src/actions/` con `"use server"`.

La combinazione Next.js 16.2.7, App Router e Server Actions soddisfa le condizioni di [GHSA-m99w-x7hq-7vfj / CVE-2026-64641](https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj). Richieste costruite appositamente possono consumare CPU e bloccare altre richieste nello stesso processo, prima dei controlli applicativi di autenticazione.

**Evidenza:** versione e funzionalità in uso confrontate con l'avviso ufficiale; nessun payload DoS eseguito. **Rimedio:** Next.js **16.2.11 o successiva** per questo specifico avviso, considerando anche S01 nell'aggiornamento complessivo.

### S03 — Media: enumerazione anonima degli identificativi delle Server Actions

**Posizione:** `package.json:21`; azioni importate dai componenti client, per esempio `src/app/league/join/page.tsx:6`.

[GHSA-955p-x3mx-jcvp](https://github.com/vercel/next.js/security/advisories/GHSA-955p-x3mx-jcvp) descrive la divulgazione di endpoint/ID delle Server Actions attraverso artefatti client pubblici in App Router. La versione installata e l'architettura sono interessate. Autenticare soltanto la pagina che usa l'azione non rende segreto l'ID.

**Impatto:** ricognizione, non accesso automatico a dati o mutazioni. Le azioni principali si riautenticano; `getLeaguePreview` è l'eccezione rilevante descritta in S13. **Rimedio:** Next.js almeno **16.2.11** per questo avviso e controlli di accesso dentro ogni azione. Non considerare segreti gli action ID.

### S04 — Alta: una piccola richiesta può bloccare il processo con `numRows`

**Posizione:** `src/actions/matchday.ts:131`, ciclo a riga 137.

`setMatches` usa `parseInt(formData.get("numRows"))`, rifiuta soltanto valori falsy e itera fino al numero fornito dal client. Una stringa di 400 cifre `9` produce `Infinity`, che supera il controllo. Il ciclo continua anche quando tutti i campi `teamA_i` e `teamB_i` sono assenti. Anche numeri finiti molto grandi causano consumo sproporzionato di CPU.

**Prerequisiti:** sessione valida e una lega propria con giornata aperta. Un utente può creare la propria lega e ottenere questo ruolo; il danno riguarda il processo condiviso, non solo la sua lega. Il limite di dimensione del body non protegge da questo payload piccolo.

**Evidenza:** riproduzione con `Infinity` e interruzione strumentata dopo 201 letture di campi, senza lasciare un loop infinito attivo. **Rimedio:** intero finito e positivo, limite derivato dal numero di squadre; preferibilmente derivare il numero delle righe sul server.

### S05 — Alta per integrità del gioco: cambiare squadra permette pronostici vietati

**Posizione:** `src/actions/league.ts:120`, aggiornamento `teamName` a riga 127; `src/actions/bet.ts:45` e 60; `src/actions/score.ts:71`.

`joinLeague` esegue un upsert anche per utenti già iscritti, aggiornando liberamente la squadra. Le scommesse esistenti restano nel database e vengono conteggiate da `scoreMatchDay` senza ricontrollare la squadra. `leaveLeague` permette inoltre di cancellare la membership e poi rientrare con una squadra diversa, senza rimuovere i pronostici.

**Riproduzione:** iscritto ad A, inserire il pronostico C–D; richiamare `joinLeague` con squadra C; inserire il pronostico A–B. Risultato: entrambe le scommesse conservate, una sola quota di ingresso. Non servono privilegi admin. È violato il divieto esplicito di scommettere sulla propria squadra.

**Rimedio:** impedire il cambio tramite nuova iscrizione; usare una squadra immutabile per la giornata oppure vietare/revisionare i cambi dopo la prima scommessa. Gestire anche uscita e rientro, non solo l'upsert.

### S06 — Alta per integrità del gioco: calcoli concorrenti possono duplicare i premi

**Posizione:** `src/actions/score.ts:18`, `48`, `50`, `52`, `160`; isolamento a riga 204.

La giornata e le scommesse vengono lette prima della transazione. Anche `isRescore` viene calcolato prima. Due richieste possono entrambe leggere `OPEN`, poi eseguire le rispettive transazioni una dopo l'altra. La seconda vede nel database una giornata già calcolata, ma continua a usare `isRescore=false`; quindi non elimina i premi già erogati e li crea una seconda volta.

**Prerequisiti:** amministratore della lega; possibile anche un doppio invio concorrente. `Serializable` non rende atomiche le letture avvenute prima della transazione. Non esiste un vincolo unico sul payout.

**Evidenza:** due snapshot `OPEN`, due transazioni seriali, quota -1 e due premi +1: saldo netto +1 invece di 0. **Rimedio:** rileggere/serializzare lo stato della giornata dentro la transazione; proteggere l'operazione con lock o aggiornamento condizionale e chiavi uniche per i movimenti. Rendere scoring e rescore idempotenti.

### S07 — Media: controllo di stato/scadenza e salvataggio dei pronostici non sono atomici

**Posizione:** `src/actions/bet.ts:15`, `26`, `36`, `40`, `45`, transazione a riga 89; `src/actions/proxyBet.ts:21`, `27`, `37`, `39`, transazione a riga 81. Controlli analoghi precedono le scritture anche nelle azioni di modifica delle giornate.

Le verifiche di membership, squadra, stato e deadline sono esterne alla transazione. Tra verifica e scrittura la giornata può scadere o essere calcolata. Un aggiornamento già avviato può quindi cambiare `predictedA/B` dopo il calcolo; l'upsert non azzera `pointsEarned`, producendo pronostici, punti e payout incoerenti. Lo stesso schema consente scritture basate su una membership o squadra divenuta obsoleta.

**Evidenza:** la riproduzione fa completare uno scoring simulato dopo la lettura `OPEN` ma prima dell'inizio della transazione delle scommesse; il pronostico viene aggiornato quando lo stato è `SCORED`, conservando i punti precedenti.

**Rimedio:** leggere e proteggere stato/membership nella stessa transazione delle scritture, coordinando tutte le azioni concorrenti sulla stessa giornata. Ricontrollare anche l'orario vicino alla scrittura; l'isolamento serializzabile da solo non fa rispettare il trascorrere del tempo.

### S08 — Media: una giornata già scaduta può essere riaperta dopo la pubblicazione dei pronostici

**Posizione:** `src/actions/matchday.ts:246`, unico controllo di stato a riga 263; `src/app/league/[id]/matchday/[matchdayId]/page.tsx:41` e 134.

Le giornate non diventano automaticamente `CLOSED` alla scadenza: restano `OPEN`, e la pagina rende pubblici tutti i pronostici quando il tempo è trascorso. `updateDeadline` controlla soltanto che lo stato sia `OPEN`; l'admin può spostare nel futuro una scadenza già passata. `placeBets` torna ad accettare nuovi pronostici/modifiche dopo che quelli degli altri sono stati consultabili.

**Prerequisiti:** amministratore della lega; rischio di equità se il termine deve essere irrevocabile dopo la pubblicazione. **Evidenza:** scadenza passata, spostamento nel futuro, scommessa accettata. La modifica di deadline viene registrata, ma le modifiche ai singoli pronostici non hanno uno storico.

**Rimedio:** rendere irreversibile la chiusura al termine; consentire proroghe solo prima della scadenza. Se la riapertura è una funzione richiesta, definire una nuova fase che non mescoli pronostici ormai pubblici con quelli riservati.

### S09 — Media: l'amministratore riceve i pronostici esatti prima della scadenza

**Posizione:** `src/app/league/[id]/admin/page.tsx:47`, `120`; componente client `src/components/AdminMatchdayPanel.tsx:1` e 23.

Il server legge le scommesse e passa al componente client l'intero record per ciascun giocatore, inclusi `predictedA`, `predictedB` e `matchId`. La UI mostra essenzialmente chi ha già scommesso, ma i valori esatti sono nei props serializzati inviati al browser anche prima della deadline. Filtrare i record per giornata non nasconde i punteggi.

**Prerequisiti:** admin della lega. Non è una fuga verso visitatori anonimi; è un vantaggio informativo se l'admin partecipa al gioco e i pronostici devono restare riservati fino alla deadline. **Evidenza:** estrazione dei props dal componente restituito dalla funzione originale, con giornata futura e pronostico 3–0 presente.

**Rimedio:** inviare soltanto ID, nickname, squadra e indicatore di partecipazione; fornire i pronostici esatti soltanto dopo la chiusura, o separare il ruolo amministrativo da quello di giocatore.

### S10 — Media: Proxy Bet può sovrascrivere pronostici già inseriti personalmente

**Posizione:** `src/actions/proxyBet.ts:83`, ramo `update` a riga 91; filtro soltanto client in `src/components/AdminMatchdayPanel.tsx:63` e 307.

L'interfaccia propone la proxy bet solo per giocatori mancanti. L'azione server non applica questo limite: accetta qualunque membro e usa un upsert che sostituisce pronostici già presenti. Un admin può chiamarla direttamente per un giocatore non selezionabile dall'interfaccia.

**Evidenza:** pronostico personale 3–0 sostituito da 0–3. Vengono creati log e notifica: la modifica non è completamente silenziosa, ma il log generico non conserva valori precedenti e successivi. Il potere oltrepassa il comportamento della funzione di assistenza descritta dalla UI.

**Rimedio:** se la proxy deve servire soltanto chi non ha scommesso, controllare questa condizione nella transazione e usare creazione condizionata. Se si vuole permettere anche una revisione da parte dell'admin, prevedere consenso/regole esplicite e storico dei valori.

### S11 — Media: dopo una proxy bet il giocatore può pagare due quote per la stessa giornata

**Posizione:** `src/actions/proxyBet.ts:110` e 121; `src/actions/bet.ts:118`.

La proxy crea una quota con reason `MatchDay N Entry Fee (Proxy)`. L'invio personale cerca invece esattamente `MatchDay N Entry Fee`, non trova il movimento già esistente e crea un secondo addebito. Il confronto inverso della proxy usa `contains: "Entry Fee"`, quindi la sequenza personale → proxy non presenta lo stesso errore.

**Evidenza:** proxy e successiva revisione personale producono due movimenti -1 e saldo -2 per una giornata. Lo scoring somma entrambe le quote e altera anche il montepremi. Se tutti fanno zero, il rimborso usa `.find`, non la somma dei movimenti del giocatore, e può restituire una sola delle due quote.

**Rimedio:** unificare il tipo di movimento, identificandolo con campi strutturati e vincolo unico per utente/giornata/tipo. Usare la causale soltanto come descrizione; rimborsi basati sull'importo totale effettivamente versato.

### S12 — Media: modificare gli accoppiamenti elimina pronostici pagati senza rimborsarli

**Posizione:** `src/actions/matchday.ts:156`, `161`, `162`; montepremi in `src/actions/score.ts:91`.

`setMatches` cancella tutte le scommesse e ricrea le partite con nuovi ID, ma mantiene le quote di ingresso. Anche inviare gli stessi accoppiamenti produce la cancellazione. Chi aveva pagato deve reinserire i pronostici prima del termine; altrimenti non partecipa al calcolo dei punti, mentre il suo versamento finanzia comunque gli altri. Non viene inviata una notifica dedicata della cancellazione dei pronostici.

**Prerequisiti:** admin e giornata non scaduta. **Evidenza:** scommessa rimossa e quota -1 ancora presente. **Rimedio:** impedire la sostituzione quando ci sono scommesse, oppure migrare i pronostici sugli accoppiamenti invariati e annullare/rimborsare le quote coinvolte nella stessa transazione, notificando gli interessati.

### S13 — Media: codici di invito a 32 bit con oracolo senza autenticazione o rate limit

**Posizione:** `src/actions/league.ts:41`, `70`, ritardo solo in `joinLeague` a riga 90.

Il codice usa `randomBytes(4)`: il prefisso fisso non aggiunge entropia, rimangono **32 bit**. `getLeaguePreview` non autentica, non limita i tentativi, non controlla la forma/lunghezza del codice e distingue codice valido da invalido restituendo ID, nome e squadre. Il ritardo di due secondi in `joinLeague` non protegge l'anteprima ed è aggirabile nel throughput con richieste parallele.

**Impatto:** possibilità di cercare inviti validi e poi iscriversi con un account Google; enumerazione di metadati e carico DB. Non è stato forzato alcun invito reale. La fattibilità dipende dal numero di leghe, dal throughput e da eventuali protezioni esterne non visibili nel repository; 32 bit non significano un recupero istantaneo di uno specifico codice.

**Evidenza:** l'azione originale restituisce una preview con sessione nulla e non chiama `getServerSession`. **Rimedio:** aumentare significativamente l'entropia, per esempio 128 bit; validare il formato e applicare rate limit condiviso per IP/account all'anteprima e all'iscrizione. Valutare scadenza e rotazione degli inviti.

### S14 — Bassa: dati personali non necessari serializzati ai componenti client

**Posizione:** `src/app/league/[id]/admin/page.tsx:38` e `121`; `src/app/league/[id]/layout.tsx:35` e `44`; `src/components/BottomNav.tsx:7`.

L'admin riceve l'intero oggetto User mediante `...u`, compresi email, immagine, emailVerified e date, anche se il pannello richiede ID, nickname e squadra. Nel layout l'email dell'admin viene passata a `BottomNav`, componente client che non usa quel prop: tutti i membri ricevono quindi un indirizzo personale superfluo.

**Evidenza:** l'email del giocatore è presente nei props del pannello nella riproduzione; il flusso dell'email dell'admin è visibile nel layout. Non sono stati osservati access token o refresh token in questi props: la relazione Account non viene caricata.

**Rimedio:** `select` con campi minimi e DTO esplicito; eliminare `adminEmail` dove inutilizzato. Non inviare l'intero record ORM al client.

### S15 — Media locale; alta nell'avviso upstream: errore anonimo nel middleware NextAuth

**Posizione:** `src/middleware.ts:3`, versione in `package.json:22`; `node_modules/next-auth/jwt/index.js` e `next/middleware.js`.

NextAuth 4.24.14 decodifica il valore Bearer con `decodeURIComponent` fuori dal try/catch. `withAuth` chiama `getToken` senza intercettare l'eccezione. Una richiesta senza cookie con `Authorization: Bearer %` genera `URIError` sui percorsi `/profile` e `/league/*`.

**Evidenza:** chiamata al middleware installato con `NextRequest` e segreto sintetico, eccezione riprodotta. L'impatto dimostrato è un errore della singola richiesta, con possibile rumore/log e consumo ripetuto; non è stato dimostrato l'arresto dell'intero processo, né un bypass di autenticazione.

**Rimedio:** NextAuth **4.24.15 o successiva** nella linea v4. Riferimento: [GHSA-xmf8-cvqr-rfgj / CVE-2026-73418](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-xmf8-cvqr-rfgj).

### S16 — Media, rischio operativo: script di test cancella dati del DB configurato

**Posizione:** `scripts/test-payouts.ts:3`, `8`–`13`.

Lo script istanzia Prisma con il database dell'ambiente e inizia con `deleteMany()` senza filtri su ledger, bet, match, matchday, league e user. Non richiede un database dedicato ai test, non vieta la produzione e non protegge con una transazione l'intera pulizia. Un errore di foreign key in uno dei passaggi successivi non annulla le cancellazioni già eseguite.

**Prerequisiti:** esecuzione locale/CI da parte di un operatore con credenziali DB; nessun endpoint web espone direttamente questo script. **Evidenza:** analisi statica; script non eseguito. **Rimedio:** ambiente di test separato, controllo esplicito della destinazione e rifiuto delle credenziali non destinate ai test; preferire fixture con cleanup mirato o DB effimero.

### S17 — Bassa, solo sviluppo: divulgazione dal server MCP di Next.js

**Posizione:** `package.json:6` (`next dev`), Next.js 16.2.7.

[GHSA-39w2-rjm5-chcv](https://github.com/vercel/next.js/security/advisories/GHSA-39w2-rjm5-chcv) riguarda l'endpoint MCP del dev server, che non verifica l'origine del sito richiedente. Un sito ostile visitato dallo sviluppatore può leggere percorsi, frammenti di codice da errori, inventario delle route e log di sviluppo. Il codice configura Prisma per loggare le query in sviluppo (`src/lib/prisma.ts:10`), aumentando i dati diagnostici da proteggere.

**Condizioni:** `next dev` attivo e interazione con un sito ostile. L'avviso esclude la produzione. Alla data dell'audit l'avviso indica ancora `16.3.?` come versione corretta: non viene inventata una versione esatta di fix. **Rimedio:** seguire l'aggiornamento dell'avviso e installare la release corretta quando identificata; limitare l'accesso al dev server e ai suoi strumenti. Nessuna lettura remota dei log effettuata.

## Carenza di autorizzazione da verificare via HTTP

**R01 — `StatsPage` e `BettingPage` dipendono dal controllo nel layout.** Posizioni: `src/app/league/[id]/stats/page.tsx:13`, `16`; `src/app/league/[id]/matchday/[matchdayId]/page.tsx:14`, `17`, `22`; controllo di membership soltanto in `src/app/league/[id]/layout.tsx:30`.

Le due pagine verificano la sessione ma non la membership prima delle query e del rendering; chiamando direttamente le funzioni con un utente estraneo restituiscono dati. La pagina delle statistiche espone classifiche/saldi/squadre; la pagina delle scommesse può mostrare i pronostici dopo la scadenza. Il layout invece controlla la membership, e un caricamento normale dell'intera pagina può essere bloccato.

La [documentazione Next.js sull'autorizzazione nei layout](https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks) avverte che i layout non vengono rieseguiti su ogni navigazione e raccomanda verifiche nel percorso di accesso ai dati. Serve un test d'integrazione su richieste RSC/navigazioni parziali e dopo la revoca della membership, per stabilire l'esposizione HTTP effettiva della versione installata. **Non classificato come bypass HTTP confermato.** Rimedio: controllo condiviso di membership nella DAL e in entrambe le pagine prima di leggere dati riservati.

## Applicabilità degli altri avvisi di dipendenza

L'inventario completo dei **34 avvisi** è in [dependency-findings.md](./dependency-findings.md); la risposta originale è in [npm-audit.json](./npm-audit.json). Il registro classifica 2 pacchetti critical, 11 high e 1 moderate, includendo i pacchetti che ereditano una dipendenza vulnerabile.

| Avviso/famiglia | Valutazione sulla codebase attuale |
| --- | --- |
| NextAuth: email normalizer / homoglyph, GHSA-7rqj-j65f-68wh | Il pacchetto è nell'intervallo vulnerabile, ma non è configurato un EmailProvider: solo Google. Non confermato come attacco applicabile. |
| NextAuth: confusione di provider OAuth, GHSA-x445-f3h2-j279 | L'[avviso ufficiale](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-x445-f3h2-j279) esclude il caso con un solo provider. Non applicabile alla configurazione attuale. |
| Next: bypass middleware con Turbopack e singola locale, GHSA-6gpp-xcg3-4w24 | Nessuna configurazione `i18n.locales`, prerequisito dell'[avviso](https://github.com/vercel/next.js/security/advisories/GHSA-6gpp-xcg3-4w24). Non va presentato come bypass attuale. |
| Next: SSRF Server Actions su custom server, GHSA-89xv-2m56-2m9x | Script di avvio `next start`, nessun custom server trovato. L'[avviso](https://github.com/vercel/next.js/security/advisories/GHSA-89xv-2m56-2m9x) distingue questi deployment; verificare se la produzione usa un server diverso e header host non vincolati. |
| Next: SSRF/Open Redirect con destinazioni dinamiche, GHSA-p9j2-gv94-2wf4 | Nessuna rewrite o redirect esterna con hostname da input utente. Non applicabile al codice attuale. |
| Next: payload senza limite su Edge, GHSA-4c39-4ccg-62r3 | Nessuna Server Action configurata con runtime Edge; il middleware Edge non rende Edge le azioni. Non applicabile al runtime dichiarato. |
| Next: confusioni della cache fetch, GHSA-68g3-v927-f742 e GHSA-4633-3j49-mh5q | Nessuna chiamata server `fetch` con i body/init descritti dagli avvisi nella codebase applicativa. Non confermate. |
| Next: RCE ImageResponse, GHSA-vcvr-r3jv-pc5j | Nessun `next/og` / `ImageResponse`. L'[avviso](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) richiede contenuti SVG controllabili dall'attaccante. Non applicabile al codice attuale. |
| Next: RCE AVIF, GHSA-2xp9-vwfh-vxw4; sharp/libheif/libvips | `sharp@0.34.5` è vulnerabile, ma non ci sono upload, AVIF nel public o remotePatterns. Nessuna provenienza di immagini controllabili da remoto è stata identificata; [rischio critico condizionato a immagini AVIF ostili](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), non exploit dimostrato. Aggiornare comunque. |
| Next: DoS SVG optimizer, GHSA-q8wf-6r8g-63ch; SSRF image optimizer, GHSA-cjq9-62q9-8jv4 | Nessuna remotePatterns configurata, nessuna immagine remota consentita. Gli avvisi delimitano l'applicabilità; non confermati qui. |
| PostCSS 8.5.15: auto-loading sourceMappingURL / divulgazione .map | Versione nell'intervallo vulnerabile. CSS del progetto sotto controllo dello sviluppatore; nessun endpoint elabora CSS di utenti. Rischio di build/strumenti con input CSS ostile, non lettura remota dimostrata dal sito. |
| braces, brace-expansion, js-yaml, browserslist | Avvisi di DoS/prototype write negli strumenti di sviluppo/build. Nessun percorso applicativo passa input HTTP a queste librerie. Conservare nell'inventario e aggiornare; non equiparare alla compromissione del sito. |
| nanoid, baseline-browser-mapping | Versioni vulnerabili installate; nessun uso applicativo dei generatori con dimensione ostile o dell'input che causa la terminazione. Non confermati come bug raggiungibili da un visitatore. |

Next.js include un runtime React compilato `19.3.0-canary-3f0b9e61-20260317`; perciò la sola versione `react@19.2.4` non basta a stabilire quali avvisi RSC siano applicabili al runtime effettivo. L'avviso Next.js direttamente applicabile è descritto in S02. Non vengono conteggiati avvisi React aggiuntivi sulla sola base del numero di versione del pacchetto top-level.

## Altre carenze e verifiche senza un exploit confermato

- `createLeague` applica sul server il limite di 15 caratteri a nome e valuta, ma non il limite UI di 20 caratteri alle squadre, né un limite al numero di squadre/leghe per account. `setMatches`/`addMatch` non verificano che tutte le squadre appartengano al campionato, che siano usate una sola volta o che la squadra a riposo sia valida. Sono carenze di validazione/integrità, oltre al DoS concreto S04. Le stringhe vengono renderizzate come testo React: nessun XSS dimostrato.
- `MatchDay` non ha un vincolo unico `(leagueId, number)`; il controllo preliminare in `createMatchDay` non evita duplicati concorrenti. Bug di consistenza, senza ulteriore impatto di sicurezza distinto dimostrato.
- Manca una strategia applicativa di revoca globale delle sessioni JWT; l'assenza da sola non dimostra account takeover. Non sono presenti endpoint pubblici di amministrazione di utenti o un requisito di revoca globale documentato.
- Manca CSP, mentre sono presenti X-Frame-Options DENY, nosniff e Referrer-Policy. L'assenza di CSP è hardening, non una prova di XSS. L'assenza di HSTS nel codice non dimostra che manchi presso il provider.
- La pagina notifiche segna come letti i messaggi durante il rendering GET. Può produrre letture involontarie con navigazione/prefetch; non è stato dimostrato un attacco CSRF che divulghi o modifichi altri dati.
- I due file `.env` locali contengono un segreto NextAuth presente e almeno 32 caratteri, senza pattern di placeholder riconosciuti. Non è una misura dell'entropia. `NEXTAUTH_URL` è HTTP localhost, coerente con sviluppo e non una prova che la produzione usi cookie insicuri. Non si registrano valori dei segreti nel rapporto.
- Le URL DB locali non hanno `sslmode` esplicito. Non è stata verificata la negoziazione TLS né la validazione del certificato; l'assenza del parametro non viene classificata automaticamente come traffico in chiaro.
- `.env`, `.env.local` e `dev.db` non sono versionati; nessun commit di questi percorsi è emerso e la ricerca di pattern comuni nel contenuto versionato e nelle modifiche storiche non ha trovato credenziali. Ricerca euristica, non garanzia di assenza di segreti.
- `package-lock.json` è presente e versionato: permette l'inventario effettuato. Non sono presenti controlli di sicurezza CI documentati nel repository.
- Non sono stati trovati SQL raw concatenati, `eval`, render HTML non escapato, upload, fetch applicative verso URL utente, provider Credentials attivo, modifica libera di adminId o azioni che consentano a un semplice membro di amministrare un'altra lega.

## Priorità di correzione

1. Aggiornare Next.js e NextAuth con una scelta che copra gli avvisi applicabili, soprattutto S01 su Windows e S02. Allineare `eslint-config-next` e verificare di nuovo tutto l'albero. Le override attuali di PostCSS e uuid non eliminano tutte le segnalazioni.
2. Imporre il limite server su `numRows` e correggere il cambio squadra/reiscrizione.
3. Rendere atomiche e idempotenti le operazioni sulla giornata e sul ledger; uniformare le quote e correggere rimborsi e cancellazioni dei pronostici.
4. Proteggere i pronostici prima della chiusura, eliminare PII superflue dai props, applicare lato server la policy proxy e impedire riaperture dopo la divulgazione.
5. Rafforzare gli inviti e i limiti di richiesta, aggiungere membership al percorso di lettura delle due pagine, isolare gli script di test dal DB reale.

La verifica successiva dovrebbe usare un database PostgreSQL di test e richieste HTTP/RSC controllate per completare la validazione delle condizioni concorrenti e di R01. Gli artefatti qui inclusi permettono già di rivedere le cause senza toccare il database configurato.
