"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export async function createLeague(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  // Verify the user exists in the database (handles cases where DB was wiped but session cookie remains)
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!dbUser) {
    throw new Error("Utente non trovato nel database. Il database di test è stato resettato. Effettua il LOGOUT e accedi nuovamente per ricreare il tuo profilo.")
  }

  const name = formData.get("name") as string
  const homeTeam = formData.get("homeTeam") as string
  const coinName = (formData.get("coinName") as string) || "Coin"
  
  const teams = formData.getAll("teams[]") as string[]

  if (!name || !homeTeam || teams.length < 2) throw new Error("Missing required fields or not enough teams")

  // Generate a random 8-character invite code
  const inviteCode = "VOLLEY-" + Math.random().toString(36).substring(2, 6).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()

  const league = await prisma.league.create({
    data: {
      name,
      homeTeam,
      coinName,
      inviteCode,
      adminId: session.user.id,
      users: {
        connect: { id: session.user.id }
      },
      teams: {
        create: teams.map(t => ({ name: t }))
      }
    }
  })

  revalidatePath("/")
  redirect(`/league/${league.id}`)
}

export async function joinLeague(prevState: any, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const inviteCodeRaw = formData.get("inviteCode") as string
  if (!inviteCodeRaw) return { error: "Codice invito vuoto." }

  const inviteCode = inviteCodeRaw.trim().toUpperCase()

  const league = await prisma.league.findUnique({
    where: { inviteCode }
  })

  if (!league) return { error: "Campionato inesistente o codice errato." }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { leagueId: league.id }
  })

  revalidatePath("/")
  redirect(`/league/${league.id}`)
}

export async function leaveLeague() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  await prisma.user.update({
    where: { id: session.user.id },
    data: { leagueId: null }
  })

  revalidatePath("/")
  redirect("/")
}

export async function updateCoinName(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const coinName = formData.get("coinName") as string
  if (!coinName) return

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user?.leagueId) return

  const league = await prisma.league.findUnique({ where: { id: user.leagueId } })
  if (league?.adminId !== user.id) throw new Error("Not admin")

  await prisma.league.update({
    where: { id: league.id },
    data: { coinName: coinName.trim() }
  })

  revalidatePath("/profile")
  revalidatePath(`/league/${league.id}`)
}
