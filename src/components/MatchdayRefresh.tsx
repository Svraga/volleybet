"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function MatchdayRefresh({ at, poll = false }: { at: number[]; poll?: boolean }) {
  const router = useRouter()
  const boundaries = JSON.stringify(at)
  useEffect(() => {
    const times: number[] = JSON.parse(boundaries)
    let timer: ReturnType<typeof setTimeout> | undefined
    const scheduleNext = () => {
      clearTimeout(timer)
      const next = times.filter(t => t > Date.now()).sort((a, b) => a - b)[0]
      // Re-arm even when refreshed data has the same dates (opening, then deadline).
      if (next) timer = setTimeout(() => { router.refresh(); scheduleNext() }, Math.min(next - Date.now() + 100, 2147483647))
    }
    scheduleNext()
    const interval = poll ? setInterval(() => { if (document.visibilityState === "visible") router.refresh() }, 30000) : undefined
    const onFocus = () => { if (poll || times.some(t => t <= Date.now())) router.refresh(); scheduleNext() }
    window.addEventListener("focus", onFocus)
    return () => { clearTimeout(timer); clearInterval(interval); window.removeEventListener("focus", onFocus) }
  }, [boundaries, poll, router])
  return null
}
