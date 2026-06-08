"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { randomBytes } from "crypto"

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
  const hasOddTeams = formData.get("hasOddTeams") === "true"
  
  const teams = formData.getAll("teams[]") as string[]

  if (!name || !homeTeam || teams.length < 2) throw new Error("Missing required fields or not enough teams")

  // Generate a secure random 8-character invite code
  const inviteCode = "VOLLEY-" + randomBytes(4).toString("hex").toUpperCase()

  const league = await prisma.league.create({
    data: {
      name,
      homeTeam,
      hasOddTeams,
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

  await prisma.league.update({
    where: { id: league.id },
    data: {
      users: { connect: { id: session.user.id } }
    }
  })

  revalidatePath("/")
  redirect(`/league/${league.id}`)
}

export async function leaveLeague(leagueId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  await prisma.user.update({
    where: { id: session.user.id },
    data: { 
      leagues: { disconnect: { id: leagueId } } 
    }
  })

  revalidatePath("/")
  redirect("/")
}

export async function deleteLeague(leagueId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league) throw new Error("Campionato non trovato")
  if (league.adminId !== session.user.id) throw new Error("Solo l'admin può eliminare il campionato")

  await prisma.$transaction(async (tx) => {
    // Cascade delete manually since schema doesn't have onDelete: Cascade for all
    await tx.bet.deleteMany({ where: { match: { matchDay: { leagueId } } } })
    await tx.match.deleteMany({ where: { matchDay: { leagueId } } })
    await tx.matchDay.deleteMany({ where: { leagueId } })
    await tx.ledger.deleteMany({ where: { leagueId } })
    await tx.team.deleteMany({ where: { leagueId } })
    await tx.auditLog.deleteMany({ where: { leagueId } })
    await tx.league.delete({ where: { id: leagueId } })
  })

  revalidatePath("/")
  redirect("/")
}

export async function updateCoinName(leagueId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const coinName = formData.get("coinName") as string
  if (!coinName) return

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (league?.adminId !== session.user.id) throw new Error("Not admin")

  await prisma.league.update({
    where: { id: league.id },
    data: { coinName: coinName.trim() }
  })

  revalidatePath("/profile")
  revalidatePath(`/league/${league.id}`)
}
