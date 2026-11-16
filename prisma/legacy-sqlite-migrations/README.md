# Migrazioni storiche SQLite

Questi file sono conservati integralmente per documentare la precedente struttura del progetto. Non vengono eseguiti sul database PostgreSQL.

La cronologia attiva è in `prisma/migrations/` e parte dalla baseline PostgreSQL verificata. Per adottarla su un database esistente usare `scripts/adopt-postgresql-baseline.cjs` dopo l'upgrade protetto, senza reset. Vedere `audit/SECURITY-FIXES-2026-11-16.md`.
