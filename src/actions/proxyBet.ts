"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { consumeRateLimit, requireUserId } from "@/lib/security"
import { saveBets } from "@/lib/betting"

export async function proxyPlaceBets(leagueId: string, matchDayId: string, formData: FormData) {
  const userId = await requireUserId()
  await consumeRateLimit(userId, "proxy-bets", 30, 60000)
  await saveBets(userId, leagueId, matchDayId, formData, true)
  revalidatePath(`/league/${leagueId}`)
  revalidatePath(`/league/${leagueId}/admin`)
  redirect(`/league/${leagueId}/admin`)
}
