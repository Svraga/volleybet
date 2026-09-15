"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function updateNickname(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const rawName = formData.get("nickname") as string
  const trimmed = rawName ? rawName.trim() : ""

  if (trimmed.length < 2) throw new Error("Il nickname deve contenere almeno 2 caratteri")
  if (trimmed.length > 15) throw new Error("Il nickname non può superare i 15 caratteri")

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: trimmed }
  })
  
  revalidatePath("/profile")
  revalidatePath("/")
}
