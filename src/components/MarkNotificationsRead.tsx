"use client"
import { useEffect } from "react"
import { markNotificationsAsRead } from "@/actions/notifications"

export default function MarkNotificationsRead({ leagueId }: { leagueId: string }) {
  useEffect(() => { void markNotificationsAsRead(leagueId).catch(() => {}) }, [leagueId])
  return null
}
