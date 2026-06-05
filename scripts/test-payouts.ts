import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function testPayouts() {
  console.log("Inizio test...")
  // Cleanup database
  await prisma.ledger.deleteMany()
  await prisma.bet.deleteMany()
  await prisma.match.deleteMany()
  await prisma.matchDay.deleteMany()
  await prisma.league.deleteMany()
  await prisma.user.deleteMany()

  // 1. Create users
  const user1 = await prisma.user.create({ data: { name: "TestUser1", email: "1@test.com" } })
  const user2 = await prisma.user.create({ data: { name: "TestUser2", email: "2@test.com" } })

  // 2. Create league
  const league = await prisma.league.create({
    data: {
      name: "Test League",
      inviteCode: "TESTCODE",
      adminId: user1.id,
      homeTeam: "HomeTeam"
    }
  })

  // 3. Create MatchDay with 3 matches
  const matchDay = await prisma.matchDay.create({
    data: {
      leagueId: league.id,
      number: 1,
      deadline: new Date(Date.now() + 10000), // future
      matches: {
        create: [
          { teamA: "A", teamB: "B" },
          { teamA: "C", teamB: "D" },
          { teamA: "E", teamB: "F" }
        ]
      }
    },
    include: { matches: true }
  })

  // --- TEST 1: ZERO POINTS ---
  console.log(">>> Esecuzione Test 1: Scenario Zero Punti")
  // Both users place 1 bet each (1 coin)
  // Total pool = 2 coins.
  
  await prisma.ledger.createMany({
    data: [
      { userId: user1.id, leagueId: league.id, matchDayId: matchDay.id, amount: -1, reason: "Bet match 1" },
      { userId: user2.id, leagueId: league.id, matchDayId: matchDay.id, amount: -1, reason: "Bet match 1" }
    ]
  })

  await prisma.bet.createMany({
    data: [
      { userId: user1.id, matchId: matchDay.matches[0].id, predictedA: 3, predictedB: 0 },
      { userId: user2.id, matchId: matchDay.matches[0].id, predictedA: 3, predictedB: 0 }
    ]
  })

  // Actual Results: 0-3 (Both lose completely)
  await performScoring(league.id, matchDay.id, [
    { id: matchDay.matches[0].id, resultA: 0, resultB: 3 },
    { id: matchDay.matches[1].id, resultA: 0, resultB: 3 },
    { id: matchDay.matches[2].id, resultA: 0, resultB: 3 }
  ])

  let ledgers1 = await prisma.ledger.findMany({ where: { amount: { gt: 0 } } })
  console.log("Rimborsi effettuati:", ledgers1.map(l => ({ user: l.userId, amount: l.amount, reason: l.reason })))
  
  if (ledgers1.length === 2 && ledgers1.every(l => l.amount === 1)) {
    console.log("✅ TEST 1 PASS: Rimborso esatto per zero punti.")
  } else {
    console.log("❌ TEST 1 FAIL: Rimborso errato.")
  }

  // --- TEST 2: EX-AEQUO ---
  console.log(">>> Esecuzione Test 2: Scenario Ex-Aequo")
  // Create another MatchDay
  const matchDay2 = await prisma.matchDay.create({
    data: {
      leagueId: league.id,
      number: 2,
      deadline: new Date(Date.now() + 10000),
      matches: {
        create: [
          { teamA: "A", teamB: "B" }
        ]
      }
    },
    include: { matches: true }
  })

  // Create 10 users to make a pool of 10 coins
  const users = await Promise.all(Array.from({ length: 10 }).map((_, i) => 
    prisma.user.create({ data: { name: `U${i}`, email: `u${i}@test.com` } })
  ))

  await prisma.ledger.createMany({
    data: users.map(u => ({ userId: u.id, leagueId: league.id, matchDayId: matchDay2.id, amount: -1, reason: "Bet" }))
  })

  // U0 and U1 guess exactly (3 points each) - tie for 1st.
  // U2 guesses sign (1 point) - 3rd place.
  // U3-U9 guess nothing (0 points).
  await prisma.bet.createMany({
    data: [
      { userId: users[0].id, matchId: matchDay2.matches[0].id, predictedA: 3, predictedB: 0 },
      { userId: users[1].id, matchId: matchDay2.matches[0].id, predictedA: 3, predictedB: 0 },
      { userId: users[2].id, matchId: matchDay2.matches[0].id, predictedA: 3, predictedB: 1 },
      ...users.slice(3).map(u => ({ userId: u.id, matchId: matchDay2.matches[0].id, predictedA: 0, predictedB: 3 }))
    ]
  })

  await performScoring(league.id, matchDay2.id, [
    { id: matchDay2.matches[0].id, resultA: 3, resultB: 0 }
  ])

  let ledgers2 = await prisma.ledger.findMany({ where: { matchDayId: matchDay2.id, amount: { gt: 0 } } })
  console.log("Payouts MatchDay 2:", ledgers2.map(l => ({ user: l.userId, amount: l.amount })))
  
  const u0Payout = ledgers2.find(l => l.userId === users[0].id)?.amount || 0
  const u1Payout = ledgers2.find(l => l.userId === users[1].id)?.amount || 0
  const u2Payout = ledgers2.find(l => l.userId === users[2].id)?.amount || 0
  
  console.log(`U0: ${u0Payout}, U1: ${u1Payout}, U2: ${u2Payout}`)
  
  if (u0Payout === 5 && u1Payout === 5 && u2Payout === 0) {
    console.log("✅ TEST 2 PASS: Ex-Aequo diviso esattamente (5 coin a testa, secondo posto 0).")
  } else {
    console.log("❌ TEST 2 FAIL: Ex-Aequo errato.")
  }
}

// Replica of scoreMatchDay logic
async function performScoring(leagueId: string, matchDayId: string, matchesToUpdate: any[]) {
  const league = await prisma.league.findUnique({ where: { id: leagueId } })!
  const matchDay = await prisma.matchDay.findUnique({
    where: { id: matchDayId },
    include: { matches: { include: { bets: true } } }
  })!

  await prisma.$transaction(async (tx) => {
    let userPoints: Record<string, number> = {} 
    let userBetsCount: Record<string, number> = {}

    for (const matchUpdate of matchesToUpdate) {
      await tx.match.update({
        where: { id: matchUpdate.id },
        data: { resultA: matchUpdate.resultA, resultB: matchUpdate.resultB }
      })

      const match = matchDay!.matches.find((m: any) => m.id === matchUpdate.id)!
      const signActual = matchUpdate.resultA > matchUpdate.resultB ? 1 : 2

      for (const bet of match.bets) {
        let points = 0
        if (bet.predictedA === matchUpdate.resultA && bet.predictedB === matchUpdate.resultB) {
          points = 3
        } else {
          const signPredicted = bet.predictedA > bet.predictedB ? 1 : 2
          if (signPredicted === signActual) points = 1
        }

        await tx.bet.update({
          where: { id: bet.id },
          data: { pointsEarned: points }
        })

        userPoints[bet.userId] = (userPoints[bet.userId] || 0) + points
        userBetsCount[bet.userId] = (userBetsCount[bet.userId] || 0) + 1
      }
    }

    const betLedgers = await tx.ledger.findMany({
      where: { matchDayId: matchDay!.id, amount: { lt: 0 } }
    })
    
    const totalPool = betLedgers.reduce((sum, l) => sum + Math.abs(l.amount), 0)

    if (totalPool > 0) {
      const usersWithBets = Object.keys(userPoints)
      const allZeros = usersWithBets.every(uid => userPoints[uid] === 0)

      if (allZeros) {
        for (const uid of usersWithBets) {
          const spent = userBetsCount[uid] || 0
          if (spent > 0) {
            await tx.ledger.create({
              data: {
                userId: uid,
                leagueId,
                matchDayId,
                amount: spent,
                reason: "Refund (Everyone scored 0)"
              }
            })
          }
        }
      } else {
        const sortedScores = Array.from(new Set(Object.values(userPoints))).sort((a, b) => b - a)
        let rankDistribution: Record<string, number> = {}
        
        const firstScore = sortedScores[0]
        const firstPlaceUsers = usersWithBets.filter(u => userPoints[u] === firstScore)

        if (firstPlaceUsers.length === 1) {
            const u1 = firstPlaceUsers[0]
            let totalSecondPlacePayout = 0
            
            if (sortedScores.length > 1) {
                const secondScore = sortedScores[1]
                const secondPlaceUsers = usersWithBets.filter(u => userPoints[u] === secondScore)
                
                for (const u2 of secondPlaceUsers) {
                    const spent = userBetsCount[u2] || 0
                    const payout = spent + 1
                    rankDistribution[u2] = payout
                    totalSecondPlacePayout += payout
                }
            }
            rankDistribution[u1] = Math.max(0, totalPool - totalSecondPlacePayout)
        } else {
            const splitAmount = totalPool / firstPlaceUsers.length
            for (const u of firstPlaceUsers) {
                rankDistribution[u] = splitAmount
            }
        }

        for (const [uid, coins] of Object.entries(rankDistribution)) {
          if (coins > 0) {
            await tx.ledger.create({
              data: {
                userId: uid,
                leagueId,
                matchDayId,
                amount: coins,
                reason: `Payout MatchDay ${matchDay!.number}`
              }
            })
          }
        }
      }
    }

    await tx.matchDay.update({
      where: { id: matchDay!.id },
      data: { status: "SCORED" }
    })
  })
}

testPayouts().catch(console.error)
