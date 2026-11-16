# Correzioni dell'audit del 16 novembre 2026

## Impatto per gli utenti

- **Nessun logout automatico.** `NEXTAUTH_SECRET`, credenziali OAuth e formato delle sessioni sono preservati. I token precedenti, senza `sessionVersion`, equivalgono alla versione zero; tutti gli utenti esistenti sono inizializzati a zero. La compatibilità è verificata sia nei test sia tramite richieste HTTP autenticate.
- **Nessun dato applicativo eliminato o ricalcolato da questo intervento.** Utenti, nickname, appartenenze, pronostici, risultati, saldi e seed dei sorteggi vengono conservati. Lo storico precedente del registro resta disponibile; i dettagli prima/dopo sono registrati per le nuove operazioni, non inventati retroattivamente.
- Nel profilo compare **Esci da tutti i dispositivi**. La revoca avviene soltanto su richiesta esplicita, con conferma; gli altri dispositivi perdono l'accesso al successivo controllo server. Non cancella dati.
- Le scadenze visualizzate sono in ora italiana, le percentuali considerano i pronostici valutati, il badge conta tutte le notifiche non lette, gli inviti mantengono il codice durante il login e l'onboarding.
- L'admin può completare pronostici mancanti senza sovrascrivere quelli già presenti o addebitare una seconda quota. I risultati pubblicati continuano a bloccare le proxy.
- Pagine lunghe suddivise in pagine; tutte le informazioni restano consultabili. Per le nuove leghe il minimo server è allineato alle quattro squadre del form. Nessuna lega esistente viene eliminata.
- Limitati a cinque al minuto gli aggiornamenti del nickname. Le regole amministrative sono aggiornate nel regolamento.

## Stato dei riscontri

| Riferimento | Correzione |
| --- | --- |
| SEC-01 e advisory dipendenze | Next.js/eslint-config-next 16.4.6; aggiornati source-map-js, Zod e catena dev. Override di minimatch limitato al parser ESLint; compatibilità verificata con lint/build. npm audit finale senza advisory. |
| SEC-02 | TLS obbligatorio e verifica strict; CA pubblica Supabase inclusa nel repository e nel bundle server. Verificata una connessione effettiva. Nessuna password cambiata. |
| SEC-03 | Nickname validato come stringa, rate limit persistente e controllo dell'utente esistente. |
| SEC-04 | Snapshot dell'autore e ID immutabile; risultati/accrediti prima e dopo il settlement; audit anche per cambio nome lega/valuta. Le rettifiche manuali non vengono eliminate dal rescore. |
| BUG-01 | Proxy può aggiungere solo le bet mancanti, anche oltre deadline, finché non ci sono risultati. |
| BUG-02 | Migrazioni SQLite archiviate in `prisma/legacy-sqlite-migrations/`; baseline PostgreSQL provata su schema vuoto e adottata sul DB esistente dopo verifica di zero drift. |
| BUG-03 | Formattazione delle date centralizzata in `src/lib/dates.ts`, fuso Europe/Rome. |
| BUG-04 | Errori attesi dell'iscrizione restituiti allo stato del form; errori di autorizzazione/tecnici non vengono nascosti. |
| BUG-05 | Codice invito precompilato; ritorno al link dopo login e scelta nickname, con destinazioni interne consentite. |
| BUG-06 | Regolamento allineato a riapertura e proxy fuori scadenza. |
| BUG-07 | Nuove leghe: almeno quattro squadre. |
| BUG-08 | Statistiche del profilo aggregate sui pronostici valutati. |
| BUG-09 | Conteggio non lette ottenuto con una query count. |
| BUG-10 | Stato pending del pulsante non sovrascrivibile da `disabled=false`. |
| BUG-11 | Risolti errori e warning lint senza disattivare le regole; aggiunta CI per lint, tipi, test, build e audit runtime. |
| H-01 | Precontrollo dei permessi prima del lock, con verifica definitiva dentro la transazione. |
| H-02 | Aggregazioni SQL per punti/coin/statistiche; payload minimi, paginazione per admin/registro/classifiche, indici sui filtri e sulle relazioni. |
| H-03 | Importi Int con conversione rifiutata se frazionari/fuori range; tipo strutturato dei movimenti; indici unici per quota e settlement; CHECK su punteggi/stato e trigger per lega e conservazione del montepremi al commit. Compatibilità dei vecchi motivi ledger gestita dal trigger. |
| H-04 | CSP per richiesta con nonce, header Permissions-Policy e HSTS. Inline CSS ammesso per il tour; inline script senza nonce bloccati. |
| H-05 | Revoca esplicita delle sessioni tramite versione utente, compatibile con i token esistenti. Durata mantenuta a 30 giorni. |
| H-06 | Script CLI e endpoint protetto per eliminare solo contatori di abuso scaduti da oltre sette giorni; pianificazione Vercel giornaliera. |

## Database già aggiornato

Eseguiti l'upgrade protetto e l'adozione della baseline sul database configurato. Le copie precedenti sono in `.local-backups/`, esclusa da Git. In transazione sono stati confrontati tutti i valori storici delle tabelle interessate: **40 utenti, 54 voci di audit, 172 movimenti e 14 giornate**. Nessun valore storico modificato, salvo l'aggiunta/classificazione dei nuovi metadata; nessun record cancellato e nessuna sessione revocata. Account OAuth, pronostici e risultati non sono stati riscritti.

La baseline è stata eseguita anche in uno schema temporaneo, annullato integralmente. Verificati rifiuto di premi sbilanciati, quota duplicata, risultato non valido e ledger riferito a una lega diversa. La cronologia Prisma risulta aggiornata e senza differenze rispetto al datamodel.

La conversione Int è protetta da precontrolli: su altri database con vecchi decimali l'upgrade si ferma, senza arrotondare. I vecchi file SQLite sono conservati per consultazione, non applicati al database PostgreSQL.

## TLS e certificato

CA: `prisma/certs/database-ca.pem`, **certificato pubblico**, non una chiave privata. Origine del download HTTPS: `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`.

Fingerprint SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

L'app normalizza l'URL di connessione sul server imponendo TLS strict; per il pooler Supabase usa il percorso assoluto del certificato incluso nel bundle. Anche gli URL locali degli strumenti Prisma sono stati aggiornati, senza cambiare credenziali o chiave delle sessioni. Per un provider diverso impostare la CA corretta, senza riutilizzare alla cieca quella Supabase.

## Deploy e altri ambienti

Il codice della repo deve ancora essere pubblicato sull'hosting per rendere attive le correzioni web. Il database configurato in questa sessione è già pronto. **Non cambiare `NEXTAUTH_SECRET`** per questo rilascio: ruotarla provocherebbe logout non necessari.

Per un altro database già esistente:

```sh
npm ci
npm run db:audit-upgrade
node scripts/adopt-postgresql-baseline.cjs --apply
npm run db:deploy
```

L'adozione rifiuta differenze di schema o una cronologia legacy applicata non riconosciuta: non eseguire reset per aggirare il controllo. Per un nuovo database vuoto basta il normale `npm run db:deploy` con la nuova baseline.

Su Vercel aggiungere **CRON_SECRET** alle variabili protette dell'hosting, usando un segreto casuale separato dalla chiave delle sessioni. È già generato localmente nei file `.env` esclusi da Git; non copiarlo in documenti o manifest pubblici. La pianificazione è in `vercel.json`, ogni giorno alle **03:15 UTC**. Senza la variabile il job risponde 401 e non elimina nulla. Su altri hosting pianificare `npm run db:prune-rate-limits` una volta al giorno.

Verificare che il deploy includa la CA pubblica; `outputFileTracingIncludes` la include nel bundle Next. La CI non usa credenziali di produzione. Non è stato pubblicato un deployment o modificato il provider OAuth durante questo intervento.

## Verifiche

**Esito finale:** 49 test superati; zero errori e warning lint; TypeScript e build riusciti; zero vulnerabilità note in npm audit completo e runtime. La CA è presente nelle tracce di tutte le 19 route compilate.

- Test di regressione: proxy parziali, permessi, rate limit, compatibilità/revoca JWT, URL di ritorno, audit prima/dopo, rettifiche manuali, sorteggi stabili e saldo del montepremi.
- Lint e TypeScript; build di produzione Next 16.4.6.
- Verifiche HTTP autenticate di sola lettura, con token nel formato precedente: profilo, dashboard, classifiche, admin, registro e pronostici. Nonce CSP coerente su tutti gli script; manutenzione anonima rifiutata. Esito: `http-fixes-2026-11-16.json`.
- Migrazioni provate su schema vuoto, inclusi i vincoli, con rollback di tutte le modifiche temporanee.
- npm audit completo e runtime, senza vulnerabilità note alla verifica finale.

Gli artefatti dell'audit precedente restano una fotografia pre-correzione. Le riproduzioni in `current-reproductions-2026-11-16.cjs` aspettano intenzionalmente i vecchi comportamenti: dopo le correzioni usare `npm run test:security` per verificare il comportamento corretto.
