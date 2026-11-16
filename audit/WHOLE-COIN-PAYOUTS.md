# Premi in coin interi

I premi nuovi e quelli ricalcolati usano esclusivamente coin interi. Il montepremi viene distribuito interamente, senza creare o eliminare coin.

- Più primi: ogni primo riceve la quota intera della divisione. Il resto viene assegnato tramite sorteggio, un coin a ciascuno di destinatari distinti.
- Primo unico: resta invariata la quota totale riservata ai secondi, al massimo un coin ciascuno e lasciando al primo più della metà del montepremi. Se non basta per tutti i secondi, vengono sorteggiati i destinatari.
- Tutti a zero o quote storiche senza pronostici: rimborso delle quote effettivamente pagate.

Ogni giornata conserva un seed casuale di 32 byte, generato dal server al primo calcolo. HMAC-SHA256 assegna un ordine casuale ai giocatori di ciascun gruppo; il seed viene riutilizzato anche dopo correzioni dei risultati. A parità di gruppo e montepremi l'assegnazione non cambia, indipendentemente dall'ordine delle query. Seed e beneficiari dei coin extra sono riportati nel log della lega; i movimenti premi indicano il coin da sorteggio.

## Aggiornamento del database

Prima di avviare la nuova versione applicare la migrazione `20261116000000_whole_coin_draw` con il normale flusso Prisma del progetto oppure eseguire:

```sh
npm run db:whole-coin-upgrade
npm run db:generate
```

Lo script SQL aggiunge solo una colonna nullable ed è ripetibile. Non modifica i premi storici. Dopo l'aggiornamento l'admin può ricalcolare una giornata già completata per sostituire atomicamente i vecchi premi frazionari con quelli interi. Per eliminare tutti i decimali dai saldi storici occorre ricalcolare tutte le giornate che contengono premi frazionari, non arrotondare i saldi visualizzati.

Il campo `Ledger.amount` resta `Float` per preservare i movimenti storici prima del ricalcolo. Le nuove quote sono già di un coin; il calcolo rifiuta quote frazionarie anomale invece di arrotondarle silenziosamente.

## Ricalcolo globale di manutenzione

`node scripts/recalculate-whole-coins.cjs` verifica in sola lettura tutte le giornate con movimenti frazionari. Aggiungendo `--apply` applica l'aggiornamento del database e converte queste giornate in un'unica transazione, utilizzando lo stesso codice di settlement dell'app. Non invia notifiche; registra l'intervento nel log delle leghe. Prima della modifica salva movimenti, risultati, punti e seed in `.local-backups/`, esclusa da Git. Verifica che risultati, punti e quote restino identici e che tutti i montepremi siano conservati.

Esecuzione del 16 novembre 2026: controllate 13 giornate completate; convertite le due con premi frazionari. Giornata 5 di ViterboBetClub: premi 2, 2, 2, 1, 1 (montepremi 8). Giornata 5 di SempioneBets: premi 2, 2, 1 (montepremi 5). Verifica globale finale: nessun movimento frazionario residuo.

## Verifiche

La suite `npm run test:security` controlla gli esempi 8/5 primi e 8/1 primo + 4 secondi, la stabilità tra ricalcoli e correzioni, e la conservazione del montepremi per gruppi da 1 a 20 giocatori e montepremi da 0 a 80 coin. Le prove sono isolate e non accedono al database.
