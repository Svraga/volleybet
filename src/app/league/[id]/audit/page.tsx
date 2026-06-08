import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { ShieldCheck } from "lucide-react"

export default async function AuditLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { leagues: true }
  })

  if (!user || !user.leagues.some(l => l.id === id)) {
    redirect("/")
  }

  const league = await prisma.league.findUnique({
    where: { id }
  })

  if (!league) redirect("/")

  const logs = await prisma.auditLog.findMany({
    where: { leagueId: id },
    orderBy: { createdAt: "desc" },
    include: { user: true }
  })

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-primary pt-12 pb-24 md:pb-12">
      <div className="w-full max-w-4xl mb-8 flex items-center justify-between">
        <h1 className="text-3xl md:text-5xl font-bold uppercase bg-white border-[4px] border-black shadow-brutal px-4 py-2 inline-block -rotate-1 flex items-center gap-4">
          <ShieldCheck className="w-8 h-8 md:w-12 md:h-12 text-blue-600" />
          Registro Trasparenza
        </h1>
      </div>

      <div className="w-full max-w-4xl">
        <Card className="bg-white border-[3px] border-black shadow-brutal">
          <CardHeader className="bg-blue-100 border-b-[3px] border-black">
            <CardTitle>Cronologia Azioni Admin</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="font-bold text-gray-700 mb-6">
              In questa pagina sono registrate tutte le azioni sensibili effettuate dall'amministratore del campionato (es. creazione/modifica giornate, inserimento risultati). 
              Questo garantisce la massima trasparenza e previene irregolarità.
            </p>

            {logs.length === 0 ? (
              <div className="text-center py-8 font-bold text-gray-500">
                Nessuna azione registrata.
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map(log => (
                  <div key={log.id} className="border-l-[4px] border-blue-600 pl-4 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black bg-blue-200 px-2 py-1 uppercase">{log.action}</span>
                      <span className="text-sm font-bold text-gray-500">
                        {new Date(log.createdAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "medium" })}
                      </span>
                    </div>
                    <p className="text-lg font-bold">{log.details}</p>
                    <p className="text-sm text-gray-600 font-bold mt-1">Effettuata da: {log.user.name}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
