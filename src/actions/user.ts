"use server"

import { prisma } from "@/lib/prisma"
import { consumeRateLimit, formText, requireUserId } from "@/lib/security"
import { revalidatePath } from "next/cache"

export async function updateNickname(formData: FormData) {
  const userId = await requireUserId()
  await consumeRateLimit(userId, "nickname", 5, 60000)
  const trimmed = formText(formData, "nickname", 15)

  if (trimmed.length < 2) throw new Error("Il nickname deve contenere almeno 2 caratteri")
  if (trimmed.length > 15) throw new Error("Il nickname non può superare i 15 caratteri")

  await prisma.user.update({
    where: { id: userId },
    data: { name: trimmed }
  })

  revalidatePath("/profile")
  revalidatePath("/")
}

export async function revokeAllSessions() {
  const userId = await requireUserId()
  await consumeRateLimit(userId, "revoke-sessions", 3, 3600000)
  await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } })
}
