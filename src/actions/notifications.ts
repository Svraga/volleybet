"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function markNotificationsAsRead(leagueId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      leagueId,
      isRead: false
    },
    data: {
      isRead: true
    }
  })

  revalidatePath(`/league/${leagueId}`)
}
