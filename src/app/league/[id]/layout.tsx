import BottomNav from "@/components/BottomNav"
import { prisma } from "@/lib/prisma"

export default async function LeagueLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  
  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      users: {
        where: { id: undefined } // Wait, this doesn't fetch admin directly if I don't know the adminId, but league has adminId
      }
    }
  })
  
  let adminEmail = ""
  if (league?.adminId) {
    const admin = await prisma.user.findUnique({ where: { id: league.adminId }})
    adminEmail = admin?.email || ""
  }

  return (
    <>
      <BottomNav leagueId={id} adminEmail={adminEmail} />
      {children}
    </>
  )
}
