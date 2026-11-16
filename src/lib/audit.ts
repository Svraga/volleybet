import "server-only"
import type { Prisma } from "@prisma/client"

type AuditData = {
  leagueId: string; userId: string; action: string; details?: string; payload?: Prisma.InputJsonValue
}

export async function recordAudit(tx: Prisma.TransactionClient, input: AuditData | { data: AuditData }) {
  const data = "data" in input ? input.data : input
  const actor = await tx.user.findUnique({ where: { id: data.userId }, select: { name: true } })
  return tx.auditLog.create({ data: { ...data, actorName: actor?.name || "Utente" } })
}
