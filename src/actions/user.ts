"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function updateNickname(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const name = formData.get("nickname") as string
  if (!name || name.trim().length < 2) throw new Error("Nickname troppo corto")

  // Sanitize input to prevent XSS
  const sanitizedName = name
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: sanitizedName }
  })
  
  revalidatePath("/profile")
}
