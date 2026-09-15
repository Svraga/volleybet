import BottomNav from "@/components/BottomNav"
import { prisma } from "@/lib/prisma"
import LastLeagueTracker from "@/components/LastLeagueTracker"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function LeagueLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/")
  }
  
  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      users: {
        where: { id: session.user.id }
      }
    }
  })

  // Security: enforce membership on all /league/[id]/* routes
  if (!league || league.users.length === 0) {
    redirect("/")
  }
  
  let adminEmail = ""
  if (league.adminId) {
    const admin = await prisma.user.findUnique({ where: { id: league.adminId }})
    adminEmail = admin?.email || ""
  }

  return (
    <>
      <LastLeagueTracker leagueId={id} />
      <BottomNav leagueId={id} adminEmail={adminEmail} />
      {children}
    </>
  )
}
