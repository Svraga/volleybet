import { timingSafeEqual } from "node:crypto"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const supplied = request.headers.get("authorization") || ""
  const expected = `Bearer ${secret}`
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const cutoff = new Date(Date.now() - 7 * 86400000)
  const old = await prisma.securityRateLimit.findMany({ where: { expiresAt: { lt: cutoff } }, take: 1000, select: { key: true } })
  const result = await prisma.securityRateLimit.deleteMany({ where: { key: { in: old.map(row => row.key) }, expiresAt: { lt: cutoff } } })
  return Response.json({ removed: result.count }, { headers: { "Cache-Control": "no-store" } })
}
