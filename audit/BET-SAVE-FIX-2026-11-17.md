# Errore nella conferma delle scommesse

Il log di produzione indica `PrismaClientUnknownRequestError` su
`ledger.findFirst`, PostgreSQL `22P03`, `incorrect binary data format in bind
parameter 4`.

La query controlla la quota di ingresso filtrando `Ledger.amount < 0`. Il
database usa ora un intero; un client Prisma generato quando il campo era
`Float` invia il parametro con un formato incompatibile. Una prova in sola
lettura con un client generato appositamente con `amount Float` ha riprodotto
esattamente codice e numero del parametro del log. Con il client attuale
(`amount Int`) il salvataggio funziona. Non abbiamo accesso all'artefatto Prisma
del deploy Vercel per ispezionarlo direttamente, ma questa prova identifica
un client non allineato come causa coerente con l'errore segnalato.

## Correzione

- `npm run build` esegue `prisma generate && next build`.
- `vercel.json` imposta esplicitamente `buildCommand: npm run build`.
- Il precedente `postinstall` resta disponibile anche per le installazioni.

La generazione avviene quindi anche quando le dipendenze vengono ripristinate
dalla cache. Non vengono eseguite migrazioni, ricalcoli o revoche di sessioni.

## Verifica

- Stessa query con vecchio client Float: riprodotto `22P03`, parametro 4.
- Salvataggio di pronostici sulle due giornate aperte: verificato con il codice
  di produzione e vincoli differiti, annullando tutte le scritture.
- Invio HTTP del modulo nella nuova build di produzione: verificato con utenti
  fittizi in uno schema isolato; invio parziale, modifica del pronostico e
  completamento dei mancanti, una sola quota addebitata e redirect HTTP 303.
  Lo schema temporaneo viene eliminato.
- Build di produzione completata con rigenerazione di Prisma; lint senza
  errori o warning; tutti i 49 test di sicurezza superati.

Il test HTTP ripetibile è `node scripts/test-bet-form-post.cjs`, dopo la build.

## Rilascio

Push della correzione e nuovo deploy Vercel. Per il primo rilascio si consiglia
un redeploy con la cache di build disattivata. Verificare nei build log che
`prisma generate` venga eseguito prima di `next build`, poi riprovare una
conferma reale e controllare i runtime log. Non cambiare `NEXTAUTH_SECRET` e non
eseguire reset del database.

Riferimento: [Prisma, deployment su Vercel e cache delle dipendenze](https://www.prisma.io/docs/orm/v6/prisma-client/deployment/serverless/deploy-to-vercel).
