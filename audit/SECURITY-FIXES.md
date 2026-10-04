# Correzioni di sicurezza VolleyBet

Data: 4 ottobre 2026. Questo documento aggiorna l'audit iniziale. Le correzioni sono nel workspace; su successiva richiesta dell'utente è stato applicato anche l'aggiornamento al database Supabase configurato. Nessun deploy o push effettuato.

## Interventi

| Riscontro | Correzione |
| --- | --- |
| S01–S03 | Next.js ed eslint-config-next aggiornati a 16.3.8, React/React DOM a 19.2.8; body delle Server Actions limitato a 64 KB. |
| S04 | Numero partite intero, finito e limitato a 32, coerente con il numero di squadre; massimo 64 squadre. Nessun ciclo controllato da un numero illimitato. |
| S05 | La squadra del membro resta fissa. Uscire scollega l'iscrizione attiva ma conserva LeagueMember; il rientro non permette un cambio squadra. Le iscrizioni storiche prive di squadra e con pronostici/movimenti vengono rifiutate. |
| S06 | Lettura di giornata, pronostici e quote dopo il lock della lega, nella stessa transazione dello scoring. I premi/rimborsi precedenti vengono sostituiti anche in una seconda richiesta concorrente. |
| S07 | Tutte le mutazioni della lega prendono lo stesso lock PostgreSQL tramite update della riga League. Autorizzazioni, iscrizione, stato e scadenza sono controllati dopo il lock; il salvataggio ricontrolla la scadenza prima di terminare. READ COMMITTED consente al secondo writer di leggere il commit del primo. |
| S08 | Una giornata scaduta, chiusa o calcolata non può essere riaperta, riconfigurata o eliminata. Lo scoring è consentito solo dopo la scadenza. |
| S09 | Il pannello admin riceve solo id, nome, squadra e hasBets dei giocatori. I valori dei pronostici non vengono caricati dalla query né serializzati al client. |
| S10 | La proxy richiede che il giocatore non abbia alcun pronostico nella giornata; usa create e rifiuta una sovrascrittura. |
| S11 | Quota unica identificata da utente/lega/giornata, senza usare reason come identità. La verifica è sotto il lock condiviso; riconosce anche le vecchie quote proxy. Lo scoring rimborsa tutte le quote effettive quando tutti totalizzano zero e quelle storiche senza pronostici. |
| S12 | Gli accoppiamenti non possono essere modificati dopo il primo pronostico o movimento. La cancellazione di una giornata ancora aperta annulla anche le quote, prima di rimuovere le FK. |
| S13 | Inviti a 128 bit, preview autenticata, limite condiviso di 10 tentativi ogni 10 minuti per utente, contatore atomico persistente PostgreSQL. Rotazione admin disponibile nell'interfaccia. Lo script di aggiornamento ruota gli inviti preesistenti deboli. |
| S14 | Eliminati i dati User superflui dai props e il caricamento/trasferimento dell'email dell'admin nella navigazione. La pagina pronostici seleziona solo il nome pubblico degli altri giocatori. |
| S15 | NextAuth aggiornato a 4.24.15; token Bearer malformati verificati con test unitario e richieste HTTP reali senza autenticazione. La convenzione Next middleware è migrata a proxy. |
| S16 | Lo script test-payouts ora esegue i test delle funzioni di produzione in memoria. Nessun PrismaClient o deleteMany globale. |
| S17 | Server MCP di sviluppo disattivato esplicitamente con experimental.mcpServer: false. |
| R01 | Controllo di appartenenza alla lega dentro StatsPage e BettingPage, prima delle query dei dati; non dipende dal layout. |

Ulteriori interventi: validazione di squadre conosciute/uniche/riposo, giornate duplicate e date valide, quote di creazione leghe/giornate, limite comune alle mutazioni della lega di 60/minuto per utente. La lettura delle notifiche avviene tramite Server Action dopo il mount del client, eliminando la scrittura durante GET/prefetch.

## Dipendenze e patch locale

Aggiornati anche i pacchetti transitivi correggibili e l'override PostCSS. L'override uuid già presente è conservata.

`npm audit --omit=dev`: **0 vulnerabilità**. `npm audit` completo: **5 segnalazioni high**, tutte riconducibili all'unico avviso [GHSA-vfj7-8cjw-p6xm di braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) e alla sua catena eslint-config-next → plugin-next → fast-glob → micromatch → braces. Il registro non indica una versione corretta. Non è stato applicato il downgrade suggerito da npm a Next 14.

`vendor/braces` contiene la versione 3.0.3 con licenza originale e protezione esplicita: limite di profondità del parser per graffe/parentesi e controllo iterativo degli AST di compile/expand/stringify, incluse profondità, dimensione e cicli. L'override locale, il lockfile e install-links nella .npmrc rendono la patch riproducibile. Il numero di versione originale è conservato: **npm audit continua correttamente a segnalare l'avviso upstream**, benché il caso vulnerabile sia mitigato nel codice installato e coperto dai test. Vedi [SECURITY-PATCH.md](../vendor/braces/SECURITY-PATCH.md). Rimuovere il fork quando sarà disponibile una correzione ufficiale.

Risultati grezzi: [npm-audit-after.json](npm-audit-after.json), [npm-audit-production-after.json](npm-audit-production-after.json).

## Verifiche

- `npm run test:security`: 22 test superati. Eseguono le funzioni TypeScript effettive con sessioni e Prisma in memoria; la concorrenza simula una coda serializzata dal lock, senza connessione al DB.
- `npx tsc --noEmit`: superato.
- `npm run db:generate`: client Prisma generato correttamente con il nuovo modello.
- `npm run build`: build Next.js di produzione superata. Richiede accesso a Google Fonts, come la configurazione originale.
- `node tests/http-smoke.cjs`: 5 verifiche HTTP superate su un server locale di produzione, con redirect delle route protette, header di sicurezza e Bearer malformato. Nessuna sessione reale, nessuna mutazione DB. [Risultati](http-smoke-results.json).
- ESLint sui file delle correzioni: nessun errore o warning. Il lint completo segnala ancora **52 errori e 13 warning** in file preesistenti non modificati, principalmente testo JSX non escapato, any e regole React sugli effect. [Risultati](lint-after.json).
- `npm run db:security-upgrade`: eseguito su Supabase. Tabella e indice creati, **1 invito debole ruotato**. Seconda esecuzione completata senza ulteriori rotazioni, verificando la ripetibilità.
- `npm run db:security-verify`: superato sul database reale. **15 tabelle con RLS**, **30 controlli dei privilegi** per i ruoli anon/authenticated, **12 prove effettive di accesso negate**, zero inviti deboli e accesso in lettura del backend Prisma mantenuto. Le prove DML usano EXPLAIN, senza eseguire scritture. [Risultati](database-security-verification.json).

Le prove non sostituiscono un test della concorrenza su PostgreSQL reale, né una verifica delle impostazioni del deployment. Non è stata eseguita una sessione OAuth reale o una prova con account di produzione. Nessuna garanzia di assenza di vulnerabilità ulteriori.

## Aggiornamento del database prima dell'avvio

Le migrazioni storiche del repository sono SQLite, mentre lo schema corrente usa PostgreSQL. Non usarle per aggiornare il PostgreSQL esistente. È predisposto un aggiornamento additivo esplicito e ripetibile:

```powershell
npm run db:security-upgrade
npm run db:security-verify
npm run db:generate
npm run build
```

Il primo comando usa DATABASE_URL da .env.local, esegue [security-upgrade.sql](../prisma/security-upgrade.sql) per creare SecurityRateLimit e il suo indice, esegue [security-supabase.sql](../prisma/security-supabase.sql) per proteggere le sole tabelle dell'app con RLS e revocare i privilegi dei ruoli client, e sostituisce i codici invito preesistenti non conformi al nuovo formato. Non cancella tabelle o record. L'aggiornamento è necessario prima di usare le nuove Server Actions. Gli amministratori devono condividere i nuovi codici dalla dashboard; quelli vecchi vengono invalidati. Se DATABASE_URL è già fornita dall'ambiente del deployment, si può eseguire direttamente `node scripts/apply-security-schema.cjs`.

VolleyBet usa NextAuth e Prisma sul server, senza client Supabase nel browser: non servono policy che consentano accesso diretto ai ruoli anon/authenticated. Il ruolo di connessione verificato è postgres con BYPASSRLS; i controlli applicativi restano nelle Server Actions e nelle query autorizzate. La protezione segue le [indicazioni ufficiali Supabase su RLS e privilegi](https://supabase.com/docs/guides/database/postgres/row-level-security). Non vengono modificate le tabelle degli schemi auth/storage o tabelle estranee alla lista esplicita dell'app. Prima dell'intervento i ruoli client non avevano già privilegi sulle tabelle: l'aggiunta di RLS rafforza questa configurazione, senza attribuire un'esposizione che non è stata riscontrata.

**Sul Supabase configurato questi passaggi sono già stati eseguiti: non è necessario incollare altro SQL nel SQL Editor prima del push.** Se il deployment punta a un altro database, rieseguire il comando di aggiornamento su quel database. Eseguire solo i due file SQL manualmente non ruota gli inviti: per completare anche quella parte usare lo script Node.

Applicare l'aggiornamento e la nuova build durante lo stesso rilascio: processi con il vecchio codice non usano il lock condiviso e non devono continuare a scrivere in parallelo. È sufficiente fermare i vecchi writer prima di avviare la nuova versione. L'aggiornamento del database configurato è completato; nessun deploy è stato effettuato.

I saldi e i risultati già alterati in passato non vengono riscritti automaticamente. Lo scoring corretto permette ricalcoli senza doppie erogazioni e rimborsi delle quote orfane; eventuali rettifiche storiche e iscrizioni prive della squadra richiedono una verifica dei dati del gestore.
