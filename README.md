# VolleyBet

Leghe di pronostici di pallavolo con Next.js 16, NextAuth e PostgreSQL/Prisma.

## Sviluppo

```sh
npm ci
npm run db:generate
npm run dev
```

Configura gli URL PostgreSQL e Google OAuth nei file `.env.local` esclusi da Git. Mantieni stabile `NEXTAUTH_SECRET` tra i rilasci per conservare le sessioni.

## Database

Per un database nuovo: `npm run db:deploy`. Per un database già esistente, l'upgrade e l'adozione della baseline sono protetti da copie precedenti e verifica dello schema: consulta [la procedura operativa](audit/SECURITY-FIXES-2026-11-16.md).

Le vecchie migrazioni SQLite sono archiviate, senza cancellazioni di dati. Non usare reset per aggiornare un database esistente. La CA pubblica del pooler Supabase ? inclusa in `prisma/certs/database-ca.pem`; TLS e verifica dell'identit? del server sono obbligatori nelle connessioni remote.

## Verifiche

```sh
npm run lint
npx tsc --noEmit
npm run test:security
npm run build
npm audit
```

La CI esegue i controlli con Node 24. Lo script `scripts/test-postgresql-baseline.cjs` verifica anche migrazioni e vincoli in uno schema temporaneo, annullato integralmente a fine prova.

## Manutenzione

`npm run db:prune-rate-limits` elimina soltanto contatori di abuso scaduti da oltre sette giorni. Su Vercel ? disponibile anche un job giornaliero protetto dalla variabile separata `CRON_SECRET`; vedi la procedura operativa per il deploy.

## Sicurezza e impatto utenti

[Audit originale](audit/SECURITY-AUDIT-2026-11-16.md) · [Correzioni e compatibilit? utenti](audit/SECURITY-FIXES-2026-11-16.md) · [Premi in coin interi](audit/WHOLE-COIN-PAYOUTS.md).
