/*
  Warnings:

  - You are about to alter the column `amount` on the `Ledger` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ledger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "matchDayId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ledger_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ledger_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Ledger" ("amount", "createdAt", "id", "leagueId", "matchDayId", "reason", "userId") SELECT "amount", "createdAt", "id", "leagueId", "matchDayId", "reason", "userId" FROM "Ledger";
DROP TABLE "Ledger";
ALTER TABLE "new_Ledger" RENAME TO "Ledger";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
