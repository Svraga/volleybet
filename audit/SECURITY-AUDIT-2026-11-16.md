# Audit di sicurezza e bug — VolleyBet

> Le correzioni successive sono documentate in [SECURITY-FIXES-2026-11-16.md](SECURITY-FIXES-2026-11-16.md). Questo report e le evidenze associate conservano lo stato pre-correzione.

Data: **16 novembre 2026**, fuso Europe/Rome. Base Git: `429071c`, includendo le modifiche locali ai premi interi, al settlement condiviso e allo script di ricalcolo. Questo report descrive lo stato attuale; il documento `SECURITY-AUDIT.md` di ottobre è storico e non va interpretato come elenco delle vulnerabilità ancora aperte.

## Risultato e priorità

**15 riscontri applicativi/operativi:** una vulnerabilità di dipendenza applicabile di gravità alta, tre ulteriori carenze di sicurezza/configurazione e undici bug. Sono inoltre documentati tutti i sei advisory distinti restituiti da npm e sei interventi di hardening, separati dai difetti verificati.

Non è stata dimostrata una RCE sfruttabile nell'app corrente. Non sono emersi bypass riprodotti dei permessi admin, accessi tra leghe, SQL injection o XSS nel perimetro esaminato. Queste conclusioni non garantiscono l'assenza di altri problemi.

Ordine consigliato:

1. **SEC-01:** aggiornare Next.js e allineare `eslint-config-next`.
2. **SEC-02:** configurare TLS obbligatorio e verifica del certificato per PostgreSQL, risolvendo prima il problema di trust rilevato dalla prova strict.
3. **BUG-01 / BUG-02 / BUG-03:** correggere completamento delle proxy bet, percorso delle migrazioni e visualizzazione delle scadenze.
4. Aggiungere rate limiting al profilo e uno storico strutturato delle correzioni; sistemare gli altri difetti elencati.

Le gravità sono valutazioni qualitative per questa applicazione. I coin sono virtuali; gli impatti di integrità non implicano perdita di denaro reale. Riapertura delle deadline, proxy oltre scadenza e sorteggio dei resti sono funzionalità espressamente richieste: non sono classificate come vulnerabilità.

## Perimetro, metodo e limiti

Esaminati Server Actions, librerie, pagine/layout, componenti client, NextAuth/Proxy, configurazioni, schema e migrazioni Prisma, dipendenze/lockfile, script di manutenzione e gestione locale dei segreti. Consultate le guide della versione Next.js installata e gli advisory primari.

- **39 test di regressione superati**, esecuzione isolata senza database: [security-tests-2026-11-16.tap](security-tests-2026-11-16.tap).
- **8 riproduzioni aggiuntive** isolate sulle funzioni/componenti effettivi: [reproductions-2026-11-16.json](reproductions-2026-11-16.json). Eseguibili con `node audit/current-reproductions-2026-11-16.cjs`.
- **Build di produzione riuscita** con accesso di rete per il font; TypeScript passato. Il precedente blocco del font era ambientale.
- **13 verifiche HTTP locali**: accesso anonimo a dieci route, sessione, rifiuto SVG nell'optimizer e header: [http-2026-11-16.json](http-2026-11-16.json). `/welcome` usa un redirect nello stream con HTTP 200: è stato controllato il contenuto, non soltanto lo status.
- Controlli **di sola lettura sul database configurato**: metadata, privilegi e aggregati di integrità, senza pubblicare credenziali o record personali: [database-2026-11-16.json](database-2026-11-16.json).
- Analisi dei parametri TLS locali e due connessioni `SELECT 1`: [tls-config-2026-11-16.json](tls-config-2026-11-16.json).
- `npm audit`: [produzione](npm-audit-2026-11-16-production.json) e [completo](npm-audit-2026-11-16.json). L'exit code 1 indica advisory presenti, non un errore del registro.
- Scan per pattern di credenziali nel contenuto dei 128 file tracciati e ricerca dei percorsi di file sensibili nella cronologia: [secret-scan-2026-11-16.json](secret-scan-2026-11-16.json). Nessuna corrispondenza rilevata. Non è una scansione completa di ogni blob di ogni commit.

Non sono stati inviati payload RCE/DoS, eseguiti carichi ostili o effettuate modifiche al database durante questa fase di audit. Il ricalcolo dei premi già richiesto dall'utente è un'attività precedente e distinta. Non sono stati cambiati codice applicativo o pacchetti in questa fase.

Non sono state testate sessioni Google reali nel browser, il deployment pubblico, la configurazione effettiva dell'hosting/WAF, il trust TLS del server di produzione o un ripristino completo da backup. Le prove isolate di concorrenza non sostituiscono uno stress test PostgreSQL. Il database ispezionato è quello raggiunto dalle credenziali locali: non si presume che tutte le variabili del deployment pubblico coincidano.

## Sicurezza

### SEC-01 — Alta: DoS di Next.js nelle Server Actions

**Posizione:** `package.json:26`, `src/actions/*`, `next.config.ts:4`. Installato `next@16.3.8`.

L'app usa App Router e più Server Actions, soddisfacendo i prerequisiti dichiarati da [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r). Il produttore descrive richieste costruite per saturare la CPU del processo senza autenticazione. La patch è disponibile da **16.4.1**. Le verifiche applicative dell'utente e il body limit di 64 KB non sono una correzione del parser del framework.

**Stato:** versione e funzionalità vulnerabili verificate; exploit distruttivo non eseguito. **Impatto:** indisponibilità del processo web. **Rimedio:** aggiornare almeno alla release corretta; il registro npm propone attualmente **16.4.6**, allineando anche `eslint-config-next`, rigenerando il lockfile e ripetendo build/test HTTP.

### SEC-02 — Media: TLS PostgreSQL opzionale e certificati non verificati per default

**Posizione:** parametri `DATABASE_URL` e `DIRECT_URL` in `.env.local`/`.env`; `src/lib/prisma.ts:8`. I valori delle credenziali non sono riportati.

Nessuna delle quattro stringhe dichiara `sslmode` o `sslaccept`. Il [parser dell'esatta revisione dell'engine Prisma installato](https://github.com/prisma/prisma-engines/blob/605197351a3c8bdd595af2d2a9bc3025bca48ea2/quaint/src/connector/postgres/url.rs#L249) usa `prefer` e `accept_invalid_certs` come default. La configurazione quindi non obbliga la cifratura e non verifica l'identità del server.

**Prova:** una connessione con `sslmode=require&sslaccept=accept_invalid_certs` riesce; con `sslmode=require&sslaccept=strict` fallisce con errore TLS. Non è stato isolato il dettaglio preciso del problema di trust. Un attaccante attivo sulla rete potrebbe sfruttare la mancata autenticazione del server; non è stato tentato un MITM.

`pg_stat_ssl` riporta `ssl=false` sul backend interrogato, ma la connessione passa attraverso un pooler: questo valore **non dimostra da solo che il tratto client–pooler sia in chiaro**. Non si attribuisce quindi una fuga di dati effettivamente osservata.

**Rimedio:** ottenere/configurare la CA e il nome host corretti del provider, verificare una connessione strict, poi rendere espliciti `sslmode=require&sslaccept=strict` per entrambi gli URL e valutare l'enforcement del provider. Aggiungere soltanto `strict` oggi causa un errore nel test: va risolto prima il trust. Per il pooler vedere anche la [documentazione Supabase sull'enforcement SSL](https://supabase.com/docs/guides/platform/ssl-enforcement).

### SEC-03 — Media: aggiornamento nickname senza rate limit; validazione del tipo incompleta

**Posizione:** `src/actions/user.ts:8-21`.

`updateNickname` autentica l'utente ma non richiama nessuno dei limiti persistenti usati dalle altre scritture. Un account può generare aggiornamenti del proprio record e revalidazioni senza un limite applicativo. Il cast `as string` non valida inoltre il contenuto di `FormData`: un `File` provoca un `TypeError` su `.trim()`.

**Prova A02:** 100 aggiornamenti simulati producono 100 scritture e zero utilizzi del rate limiter; un campo File genera il TypeError. Nessun carico è stato inviato al database reale. Non è una possibilità di modificare il nickname altrui né una dimostrazione di DoS globale.

**Rimedio:** usare `requireUserId`, `formText` e un limite dedicato al profilo; restituire alla UI gli errori attesi. Il controllo di lunghezza è già presente per input stringa validi.

### SEC-04 — Media, tracciabilità: le correzioni non conservano prima/dopo

**Posizione:** `src/lib/settlement.ts:51`, `src/lib/settlement.ts:192-201`, `src/actions/league.ts:109-127`, `src/app/league/[id]/audit/page.tsx:28-31,69`.

Il rescore sostituisce risultati/punti, elimina i vecchi accrediti e registra soltanto che risultati e classifiche sono stati ricalcolati. Mancano i punteggi prima/dopo e la distribuzione precedente. La modifica di nome lega/valuta non genera una voce di audit. Il registro mostra inoltre il nickname attuale dell'autore tramite la relazione `user`, senza un'etichetta storica o ID visibile.

**Impatto:** dal registro non si può ricostruire una correzione controversa o distinguere facilmente autori con nickname uguali/cambiati. Non è un'escalation: l'admin è già autorizzato a correggere i risultati. Seed e beneficiari dei coin extra sono invece già registrati dal nuovo sorteggio.

**Rimedio:** eventi strutturati con ID immutabili, snapshot prima/dopo di risultati e accrediti, timestamp e causale; registrare anche le modifiche delle impostazioni. Evitare di pubblicare pronostici riservati prima della chiusura.

## Bug funzionali e operativi

### BUG-01 — Media: proxy incompleta accettata e impossibile da completare dopo la deadline

**Posizione:** `src/lib/betting.ts:20,26`; `src/components/AdminMatchdayPanel.tsx:75-76,347`.

L'azione salta i campi vuoti e accetta qualunque insieme non vuoto di pronostici. Dopo un primo salvataggio, il controllo proxy rifiuta l'intero giocatore perché ha già almeno una bet. La UI lo sposta fra chi ha scommesso. Una richiesta proxy incompleta può dunque addebitare la quota lasciando partite senza pronostico; dopo la deadline non può completarle né il giocatore né l'admin tramite proxy.

**Prova A01:** due partite ammesse, salvataggio proxy di una sola riuscito, completamento proxy respinto, completamento personale respinto a giornata scaduta. Il percorso UI normale richiede tutti i campi proxy: per produrre il caso provato serve una richiesta parziale diretta. Le giocate personali parziali sono peraltro descritte come ammesse dal tutorial, quindi non si propone di vietarle indiscriminatamente.

**Rimedio:** o imporre completezza alla proxy iniziale, oppure consentire all'admin di aggiungere solo i pronostici mancanti senza sovrascrivere quelli presenti, sempre prima dei risultati e con quota unica/audit.

### BUG-02 — Media: cronologia migrazioni incompatibile con PostgreSQL

**Posizione:** `prisma/migrations/migration_lock.toml:3`, `prisma/migrations/20260604084525_init/migration.sql:23`, `prisma/migrations/20260604091940_float/migration.sql`, `prisma/schema.prisma:11`.

Lo schema corrente dichiara PostgreSQL; il lock delle migrazioni dichiara SQLite e le migrazioni iniziali usano sintassi SQLite, tra cui `DATETIME` e ricostruzioni tramite PRAGMA. La nuova migrazione PostgreSQL dei coin è aggiunta a questa cronologia incompatibile. Un normale `prisma migrate deploy` non è un percorso utilizzabile così com'è. Non è stato eseguito contro il DB live.

Gli script SQL espliciti già usati aggirano il problema ma non rendono valida la cronologia. **Rimedio:** preparare una baseline PostgreSQL coerente con lo schema reale, provarla su un database vuoto e documentare il passaggio per i DB esistenti; non cancellare o applicare alla cieca migrazioni in produzione.

### BUG-03 — Media: alcune scadenze sono visualizzate nel fuso del server

**Posizione:** `src/app/league/[id]/page.tsx:117`, `src/app/league/[id]/matchday/[matchdayId]/page.tsx:73`, timestamp del registro/notifiche.

Le card delle aperture programmate usano esplicitamente `Europe/Rome`, mentre altre scadenze SSR chiamano `toLocaleString('it-IT')` senza `timeZone`. `it-IT` decide il formato, non il fuso. Su un host UTC l'orario differisce di una o due ore dall'Italia e può far perdere una scadenza.

**Prova B03:** lo stesso istante del 16 novembre produce 20:00 in UTC e 21:00 a Roma. Il fuso del deployment pubblico non è stato verificato. **Rimedio:** centralizzare formato e fuso delle scadenze, distinguendolo chiaramente dall'orario locale del dispositivo usato nei form.

### BUG-04 — Bassa: errori attesi di iscrizione non arrivano allo stato del form

**Posizione:** `src/actions/league.ts:49-74`, `src/app/league/join/page.tsx:12,148`.

`joinLeague` restituisce `{ error }` per un invito inesistente, ma lancia eccezioni per squadra errata, squadra storica diversa e altri errori di input. Il componente usa `useActionState` e visualizza solo `state.error`, senza intercettare queste eccezioni. In produzione l'utente può ricevere un errore generico al posto della spiegazione prevista.

**Prova B01:** una squadra non appartenente alla lega causa un reject, non uno stato di errore. **Rimedio:** distinguere errori attesi da errori tecnici/autorizzativi e ritornare gli attesi al form.

### BUG-05 — Bassa: link invito non precompila il codice; login perde la destinazione

**Posizione:** `src/components/CopyInviteButton.tsx:9`, `src/app/league/join/page.tsx:13`, `src/components/AuthButtons.tsx:12`.

La condivisione genera `/league/join?code=...`, ma la pagina inizializza il codice a stringa vuota e non legge il parametro. Per un destinatario non autenticato il bottone di login imposta inoltre sempre `callbackUrl: '/'`. Il link non completa il percorso previsto e l'utente deve recuperare/incollare il codice dal testo condiviso.

**Rimedio:** leggere e validare il parametro, preservare una destinazione interna consentita durante il login. Non introdurre redirect aperti verso URL arbitrari.

### BUG-06 — Bassa: regolamento non allineato alle nuove scadenze/proxy

**Posizione:** `src/components/LeagueRules.tsx:14-15`.

Il testo dice che dopo la chiusura i pronostici non sono più modificabili e che l'admin può fare proxy soltanto a scommesse aperte. L'app consente, come richiesto, riapertura della giornata e proxy oltre deadline prima dei risultati. **Rimedio:** aggiornare queste due sezioni con le eccezioni amministrative e le relative condizioni. La sezione premi è già aggiornata ai coin interi.

### BUG-07 — Bassa: il server accetta leghe di due squadre, senza partite pronosticabili

**Posizione:** `src/actions/league.ts:23`, `src/lib/betting.ts:27-35`.

Con due squadre c'è una sola partita e tutti i membri devono appartenere a una di esse: il divieto di pronosticare sulla propria squadra esclude l'unica partita per chiunque. Il minimo server di due squadre ammette quindi una configurazione non giocabile, anche se il form normale propone altri numeri.

**Prova B02:** una giornata con il solo incontro A–B e membro della squadra A non può salvare alcun pronostico. **Rimedio:** minimo coerente con il gioco o regola esplicita per questo formato.

### BUG-08 — Bassa: precisione del profilo penalizzata dai pronostici ancora da calcolare

**Posizione:** `src/app/profile/page.tsx:26,52-54`.

Il denominatore include tutte le bet, anche quelle con `pointsEarned=null`. La pagina classifiche usa invece soltanto le giornate `SCORED`. **Prova B05:** una bet esatta e una ancora in attesa danno 50% nel profilo, pur avendo 100% sugli esiti disponibili. **Rimedio:** calcolare le percentuali sui soli pronostici valutati e mostrare separatamente quelli pendenti.

### BUG-09 — Bassa: badge notifiche limitato alle ultime dieci

**Posizione:** `src/app/league/[id]/page.tsx:25-29`, `src/components/NotificationBell.tsx:11`.

Il dashboard carica solo dieci notifiche e il badge conta le non lette di quell'array. Con più di dieci non lette sottostima il totale; con le ultime dieci lette può mostrare zero pur avendo non lette più vecchie. **Rimedio:** query `count` per il totale e lista recente separata. Non è una perdita delle notifiche salvate.

### BUG-10 — Bassa: `disabled={false}` riabilita SubmitButton mentre è pending

**Posizione:** `src/components/SubmitButton.tsx:23-25`.

Lo spread `{...props}` viene dopo `disabled={pending || props.disabled}`. Se il chiamante passa esplicitamente `false`, sovrascrive il blocco del form pending. È il caso del pulsante di apertura anticipata quando gli accoppiamenti esistono.

**Prova B04:** `pending=true` e `disabled=false` producono un bottone abilitato. Le transazioni mitigano diverse conseguenze economiche, quindi non si attribuiscono doppi premi. **Rimedio:** estrarre `disabled` dalle props oppure applicare il valore calcolato dopo lo spread.

### BUG-11 — Bassa, qualità: lint globale non passa

**Posizione/evidenza:** [lint-2026-11-16.json](lint-2026-11-16.json).

Il controllo riporta **52 errori e 11 warning** nel codice applicativo: entità JSX non escaped, `any`, setState negli effect e altri problemi. Build e TypeScript passano: gli errori lint non equivalgono tutti a vulnerabilità o crash. Una pipeline che richieda lint verde però si ferma e i nuovi problemi sono più difficili da distinguere dal rumore esistente.

**Rimedio:** correggere le segnalazioni e aggiungere i controlli alla CI, senza disattivare globalmente le regole.

## Inventario completo degli advisory npm

`npm audit --omit=dev` segnala **2 pacchetti** (1 critico, 1 alto), con **4 advisory distinti**. Il controllo completo segnala **10 pacchetti** (1 critico, 2 alti, 7 moderati), con **6 advisory distinti**; diversi pacchetti ereditano lo stesso advisory attraverso le dipendenze. I numeri dei pacchetti non sono il numero di exploit applicabili.

| Advisory | Installazione / patch | Valutazione per questa repo |
| --- | --- | --- |
| [Next Server Actions DoS](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) | Next 16.3.8; corretto in 16.4.1 | **Applicabile, SEC-01**. Nessun payload DoS eseguito. |
| [Next Image Optimization RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) | Next 16.3.8; corretto in 16.4.1; workaround sharp ≥0.35.5 | **Mitigato nell'installazione esaminata:** sharp è già 0.35.5. Il produttore indica inoltre Linux glibc come prerequisito; l'OS della produzione non è verificato. L'optimizer locale rifiuta SVG con le impostazioni correnti. Non è una RCE dimostrata. |
| [Next `use cache` typed arrays RCE](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) | Next 16.3.8; corretto in 16.4.1 | **Prerequisiti assenti nel sorgente:** Cache Components non abilitati e nessuna funzione `use cache` che restituisca array tipizzati. Aggiornare comunque il framework. |
| [source-map-js indexed map DoS](https://github.com/7rulnik/source-map-js/issues/76) | 1.2.1 via PostCSS/Tailwind; [patch 1.2.2](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2) | Presente anche nella classificazione npm production, ma nessuna funzione della web app accetta source map dall'utente e le riemette. **Percorso HTTP sfruttabile non individuato**; rischio se build/tooling processano mappe non fidate. |
| [minimatch globparts amplification](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249) | 10.2.5 nel parser TypeScript ESLint; npm indica patch 11.0.1 | **Solo tooling dev.** Richiede pattern controllati dall'attaccante e ottimizzazione elevata; nessuna esposizione applicativa individuata. L'advisory primario descrive 10.2.6, il registro npm applica un range più ampio: la divergenza è conservata, non risolta assumendo un exploit della 10.2.5. minimatch 3.1.5 presente alla radice non ricade nel range segnalato. |
| [Zod constrained collections DoS](https://github.com/colinhacks/zod/pull/6652) | Zod 4.4.3, classificato dev; npm indica patch 4.6.6 | **Nessun import Zod nel codice applicativo.** Il fix primario anticipa i limiti delle collezioni prima di validarne gli elementi; non rende sicure automaticamente tutte le collezioni illimitate. Aggiornare la catena dev e non trattarlo come endpoint vulnerabile dimostrato. |

Non sono state aggiornate dipendenze durante l'audit. Dopo l'upgrade di Next ricontrollare anche i pacchetti transitivi e il lockfile, evitando override incompatibili applicati alla cieca.

## Hardening e rischi condizionati, separati dai bug verificati

### H-01 — Lock acquisito prima dell'autorizzazione

`src/lib/security.ts:51-59` acquisisce un lock di scrittura sulla lega prima di controllare ruolo/membership. La riproduzione A03 conferma che anche una richiesta poi rifiutata prende il lock. Il limite per account e il rollback sono presenti: **non è stato dimostrato un DoS sotto carico né un bypass**. Un precontrollo di autorizzazione ridurrebbe la contesa, mantenendo il controllo definitivo dopo il lock per evitare race.

### H-02 — Query storiche senza paginazione e indici insufficienti

Stats, pannello admin, profilo e registro leggono intere cronologie. Gli indici del database mostrano, fra gli altri, soltanto la primary key su Ledger, MatchDay, Match, AuditLog e Notification. Join e filtri per lega/giornata/data crescono quindi senza indici dedicati. La lettura non ha limiti analoghi alle scritture; la preview prende anche il lock della lega mentre calcola.

Con molti partecipanti/giornate è un rischio di latenza, memoria e contesa, **non un degrado misurato sul dataset attuale**. Aggiungere paginazione, aggregazioni SQL, selezioni minime e indici su relazioni/filtri effettivi; validare con piani query. Evitare indici indiscriminati o load test sul servizio reale.

### H-03 — Invarianti dei coin affidate al codice, non al database

`Ledger.amount` è ancora Float per preservare lo storico e mancano vincoli CHECK su importi interi, punteggi e stato. Mancano anche chiavi strutturate per distinguere quota/premio/rimborso e unicità per numero giornata nella lega. Le azioni correnti serializzano le scritture, verificano le quote e producono premi interi: **non sono state trovate violazioni attuali**. Valutare Int/Decimal e vincoli dopo una migrazione esplicita, senza cast o arrotondamenti distruttivi. La cancellazione di tutti gli accrediti positivi di una giornata nel rescore richiede inoltre attenzione se in futuro si introducono rettifiche manuali di altro tipo.

### H-04 — Header di difesa aggiuntiva

Presenti e verificati `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`. Mancano CSP e Permissions-Policy nella configurazione della repo. Non è stato trovato un sink XSS controllabile; una CSP è difesa in profondità, non la correzione di un XSS dimostrato. HSTS non compare sul server HTTP locale: **non si conclude che manchi sull'hosting HTTPS**, che può aggiungerlo autonomamente.

### H-05 — Revoca delle sessioni JWT

NextAuth usa JWT e non un elenco applicativo di sessioni revocabili per utente. La cancellazione dell'utente invalida le mutazioni che usano `requireUserId`; per revocare un singolo token sottratto o tutte le sessioni senza cancellare l'utente non è presente una funzione dedicata. È una scelta standard della strategia JWT, **non un bypass di autenticazione dimostrato**. Valutare durata esplicita, versionamento delle sessioni e revoca in base al modello di rischio.

### H-06 — Contatori rate limit senza pulizia periodica

Il contatore riutilizza la stessa chiave a finestra scaduta, quindi non cresce a ogni richiesta. Non esiste però un job per rimuovere chiavi di utenti inattivi: nel controllo risultano 117 righe, tutte scadute. Il volume attuale è piccolo; una pulizia pianificata evita crescita nel tempo. Non è stato individuato un modo per usare scope arbitrari dall'esterno.

## Controlli positivi e stato del database

- Quindici tabelle applicative con RLS attiva; nessun privilegio di tabella per `anon` e `authenticated`. Il ruolo backend possiede le tabelle e ha BYPASSRLS: scelta esplicita dell'architettura Prisma, da non esporre nel client.
- Nessuna vista o funzione nello schema `public` rilevata dai controlli metadata aggiuntivi. Nessun collegamento Ledger–MatchDay tra leghe differenti, risultato/pronostico non valido o pronostico sulla propria squadra nell'aggregato esaminato.
- Nessun invito debole; generazione casuale a 128 bit, validazione, rate limit e rotazione presenti. Condivisione del codice tra membri è un comportamento di prodotto, non una fuga anonima.
- Zero movimenti frazionari, quote duplicate, numeri giornata duplicati, giornate calcolate con montepremi sbilanciato e discrepanze punti/risultati nel database ispezionato.
- Tredici giornate calcolate. Undici giornate storiche non hanno ancora seed: non avevano bisogno della conversione dei premi e il prossimo rescore ne assegna uno. Non è un errore del sorteggio attuale.
- Autorizzazioni server presenti sulle mutazioni; pagine sensibili non dipendono soltanto dal layout. Nessun dato predittivo esatto nei props del pannello admin prima della chiusura nei test di regressione.
- Scoring/rescore/quote coordinati tramite lock e transazione. I test coprono mancati doppi premi, rollback e stabilità del sorteggio anche dopo una correzione e il ripristino dei risultati.
- Le query raw esaminate usano template parametrizzati o SQL fisso del repository; nessuna interpolazione SQL controllata dall'utente individuata.
- Nessun uso di `dangerouslySetInnerHTML`, `eval` o comandi shell basati su input applicativo individuato. Alert e nickname sono renderizzati come testo React; descrizioni HTML del tour sono costanti.
- NextAuth Google configura PKCE/state; cookie di sessione HttpOnly/SameSite e Secure su URL HTTPS tramite i default della libreria. Non sono stati alterati questi default. Il semplice cookie `lastLeagueId` non è un'autorizzazione e il server ne verifica la membership.
- Script di manutenzione: dry run predefinito, `--apply` esplicito, copia precedente esclusa da Git, transazione unica, uso del settlement condiviso, verifica di risultati/punti/quote e montepremi. Nessun nuovo comando di scrittura è stato eseguito durante questo audit.

## Ripetizione delle verifiche

```sh
npm run test:security
node audit/current-reproductions-2026-11-16.cjs
npm run build
node audit/http-readonly-2026-11-16.cjs
npx tsc --noEmit
npx eslint -f json -o audit/lint-2026-11-16.json
npm audit --omit=dev --json
npm audit --json
```

I comandi `node audit/database-readonly-2026-11-16.cjs` e `node audit/tls-config-2026-11-16.cjs` richiedono le credenziali locali e accesso di rete al database; non modificano dati. Non eseguire gli script `apply-*`, il ricalcolo con `--apply` o `migrate deploy` per ripetere questo audit.
