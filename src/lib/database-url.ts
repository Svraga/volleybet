import { resolve } from "node:path"

export function secureDatabaseUrl(raw: string | undefined) {
  if (!raw) return raw
  const url = new URL(raw)
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    url.searchParams.set("sslmode", "require")
    url.searchParams.set("sslaccept", "strict")
    if (url.hostname.endsWith(".pooler.supabase.com")) {
      url.searchParams.set("sslcert", resolve(process.cwd(), "prisma/certs/database-ca.pem"))
    }
  }
  return url.toString()
}
