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

  const trimmedName = name.trim()
  const trimmedHome = homeTeam.trim()
  const trimmedCoin = (coinName || "Coin").trim()

  if (!trimmedName || !trimmedHome || teams.length < 2) throw new Error("Campi obbligatori mancanti o squadre insufficienti")
  if (trimmedName.length > 15) throw new Error("Il nome del campionato non può superare i 15 caratteri")
  if (trimmedCoin.length > 15) throw new Error("Il nome della valuta non può superare i 15 caratteri")

  // Sanitize and deduplicate teams
  const cleanTeams = Array.from(new Set(teams.map(t => t.trim()).filter(Boolean)))
  if (cleanTeams.length < 2) throw new Error("Inserisci almeno due squadre valide e distinte")
  if (!cleanTeams.includes(trimmedHome)) throw new Error("La squadra reale deve far parte delle squadre del campionato")

  // Generate a secure random 8-character invite code
  const inviteCode = "VOLLEY-" + randomBytes(4).toString("hex").toUpperCase()

  const league = await prisma.league.create({
    data: {
      name: trimmedName,
      homeTeam: trimmedHome,
      hasOddTeams,
      coinName: trimmedCoin,
      inviteCode,
      adminId: session.user.id,
      users: {
        connect: { id: session.user.id }
      },
      teams: {
        create: cleanTeams.map(t => ({ name: t }))
      }
    }
  })

  revalidatePath("/")
  redirect(`/league/${league.id}`)
}

export async function joinLeague(prevState: any, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  // ARTIFICIAL DELAY (2s): Mitigazione base contro bot e script di Brute-Forcing del codice invito
  await new Promise(resolve => setTimeout(resolve, 2000))

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

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league) throw new Error("Campionato non trovato")

  if (league.adminId === session.user.id) {
    throw new Error("L'amministratore non può abbandonare il proprio campionato. Puoi eliminarlo dalle impostazioni del profilo se non ti serve più.")
  }

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
    await tx.notification.deleteMany({ where: { leagueId } })
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

  const trimmed = coinName.trim()
  if (trimmed.length === 0) throw new Error("Il nome della valuta non può essere vuoto")
  if (trimmed.length > 15) throw new Error("Il nome della valuta non può superare i 15 caratteri")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (league?.adminId !== session.user.id) throw new Error("Not admin")

  await prisma.league.update({
    where: { id: league.id },
    data: { coinName: trimmed }
  })

  revalidatePath("/profile")
  revalidatePath(`/league/${league.id}`)
}

export async function updateLeagueName(leagueId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Not authenticated")

  const leagueName = formData.get("leagueName") as string
  if (!leagueName) return

  const trimmed = leagueName.trim()
  if (trimmed.length === 0) throw new Error("Il nome del campionato è obbligatorio")
  if (trimmed.length > 15) throw new Error("Il nome del campionato non può superare i 15 caratteri")

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (league?.adminId !== session.user.id) throw new Error("Not admin")

  await prisma.league.update({
    where: { id: league.id },
    data: { name: trimmed }
  })

  revalidatePath("/profile")
  revalidatePath(`/league/${league.id}`)
}
