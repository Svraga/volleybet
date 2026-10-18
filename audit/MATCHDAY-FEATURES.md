# Apertura programmata, pronostici e regolamento

## Deploy

Prima di pubblicare questa versione su Vercel, aggiungere la colonna opzionale
`MatchDay.opensAt` al database PostgreSQL/Supabase di destinazione:

```sh
npm run db:matchday-opening-upgrade
```

Il comando usa il database configurato in `.env.local`. Verificare che sia quello
di destinazione. In alternativa eseguire `prisma/matchday-opening-upgrade.sql`
nel SQL Editor di Supabase. Lo script è ripetibile, non modifica le giornate
esistenti e funziona anche mentre è online la versione precedente.
Non usare le vecchie migrazioni SQLite per questo database PostgreSQL.

Il client Prisma viene rigenerato da `postinstall` durante il deploy. In locale:

```sh
npm run db:generate
```

## Comportamento

- `opensAt = NULL` mantiene l'apertura immediata delle giornate storiche.
- Le giornate programmate conservano lo stato OPEN, ma accettano pronostici solo
  nell'intervallo `opensAt <= ora < deadline`. Non serve cron né una mutazione
  del database al momento dell'apertura. La dashboard aggiorna la vista al
  raggiungimento dell'apertura o della scadenza e quando torna in primo piano.
- L'admin può configurare gli accoppiamenti in anticipo e aprire subito una
  giornata programmata con accoppiamenti già impostati. La deadline rimane valida.
- I form convertono gli orari locali in ISO con fuso esplicito prima dell'invio.
  Il server rifiuta date passate e aperture successive o uguali alla scadenza.
- Pronostici è la quarta voce della navigazione. Solo i membri possono leggere
  le giocate delle giornate chiuse/scadute, comprese quelle di ex partecipanti.
  I filtri per giocatore e squadra in campo si inizializzano su Tutti per giornata.
- Prima del calcolo i box sono neutri. Dopo: rosso 0, giallo 1, verde 3, con
  punteggio testuale. La pagina in attesa aggiorna i risultati ogni 30 secondi.
- Il pulsante pergamena accanto al nome della lega apre un dialogo con le regole
  di quote, scadenze, punti, premi, squadra di appartenenza e trasparenza.

## Verifica

- 31 regressioni isolate sul codice di produzione: incluse date, fusi espliciti,
  apertura automatica e anticipata, permessi, riservatezza, ricalcolo e rollback.
  Questi test non si collegano al database reale.
- TypeScript e lint sui file modificati.
- Verifica in Chrome headless su una pagina temporanea con dati di esempio:
  filtri inizializzati a Tutti, filtri combinati, colori prima/dopo i risultati,
  dialogo regolamento e tasto Escape, layout mobile/desktop, conversione degli
  orari Europe/Rome in UTC. La pagina di esempio viene rimossa prima della build.
- La build locale usa `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` con un fallback di test
  per evitare il download di Google Fonts nell'ambiente con rete limitata.
  Nessuna modifica al font o alla configurazione di produzione viene pubblicata.
- Build completata con il fallback di test e 6 controlli HTTP sulle rotte protette
  (inclusa Pronostici), senza sessioni autenticate né modifiche al database.
