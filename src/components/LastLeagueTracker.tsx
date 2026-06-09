"use client"

import { useEffect } from "react"

export default function LastLeagueTracker({ leagueId }: { leagueId: string }) {
  useEffect(() => {
    if (leagueId) {
      document.cookie = `lastLeagueId=${leagueId}; path=/; max-age=31536000; SameSite=Lax`
    }
  }, [leagueId])

  return null
}
