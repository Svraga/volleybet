import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { ArrowLeft } from "lucide-react"

export default async function NotificationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/")

  const league = await prisma.league.findUnique({
    where: { id },
    include: { users: { where: { id: session.user.id } } }
  })

  if (!league || league.users.length === 0) {
    redirect("/")
  }

  // Fetch all notifications for this user in this league
  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      leagueId: id,
    },
    orderBy: { createdAt: "desc" },
    take: 50 // Limit to 50
  })

  // Mark all as read
  const unreadCount = notifications.filter(n => !n.isRead).length
  if (unreadCount > 0) {
    await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        leagueId: id,
        isRead: false
      },
      data: { isRead: true }
    })
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-primary pt-12">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <div className="flex justify-between items-center bg-white border-[4px] border-black p-4 shadow-brutal">
          <h1 className="text-2xl font-black uppercase">Le tue Notifiche</h1>
          <Link href={`/league/${id}`}>
            <Button variant="outline" className="border-[2px] border-black gap-2">
              <ArrowLeft className="w-4 h-4" /> Torna alla Lega
            </Button>
          </Link>
        </div>

        <div className="bg-white border-[4px] border-black shadow-brutal divide-y-[3px] divide-black">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500 font-bold">
              Non hai ancora ricevuto notifiche in questa lega.
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} className={`p-4 ${!n.isRead ? 'bg-yellow-100' : 'bg-white'}`}>
                <p className="font-bold text-lg">{n.message}</p>
                <p className="text-sm text-gray-500 mt-2 font-bold">
                  {new Date(n.createdAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            ))
          )}
        </div>

        <Link href={`/league/${id}/audit`} className="w-full">
          <Button variant="primary" className="w-full p-6 text-lg uppercase font-black">
            Vedi Registro Trasparenza Admin
          </Button>
        </Link>
      </div>
    </main>
  )
}
