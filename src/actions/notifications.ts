"use server"

import { prisma } from "@/lib/prisma"
import { requireLeagueMember, requireUserId } from "@/lib/security"
import { revalidatePath } from "next/cache"

export async function markNotificationsAsRead(leagueId: string) {
  const userId = await requireUserId()
  await requireLeagueMember(leagueId, userId)

  await prisma.notification.updateMany({
    where: {
      userId: userId,
      leagueId,
      isRead: false
    },
    data: {
      isRead: true
    }
  })

  revalidatePath(`/league/${leagueId}`)
}
