"use client"

import { Button } from "./ui/Button"
import { useRouter } from "next/navigation"

export default function TourTrigger({ leagueId }: { leagueId: string }) {
  const router = useRouter()

  const startTour = () => {
    localStorage.setItem("volleybet_force_tour", "true")
    router.push(`/league/${leagueId}`)
  }

  return (
    <Button variant="primary" onClick={startTour} className="w-full font-bold text-lg bg-yellow-300 hover:bg-yellow-400 text-black border-[3px] border-black shadow-brutal active:translate-x-1 active:translate-y-1 active:shadow-none transition-all">
      📖 Come si gioca?
    </Button>
  )
}
