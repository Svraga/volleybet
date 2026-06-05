"use client"

import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { useTourStore } from "@/store/tour"

export default function AdminButtonClient({ leagueId }: { leagueId: string }) {
  const { isTourActive } = useTourStore()

  return (
    <Link href={`/league/${leagueId}/admin`} onClick={(e) => { if (isTourActive) e.preventDefault() }}>
      <Button id="tour-admin-button" variant="secondary">Pannello Admin</Button>
    </Link>
  )
}
