"use client"

import { useId, useState } from "react"
import { CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/Button"
import MatchdayDateForm from "@/components/MatchdayDateForm"
import { updateDeadlineFromForm } from "@/actions/matchday"

export default function ChangeDeadlineButton({ leagueId, matchDayId, deadline, opensAt }: {
  leagueId: string; matchDayId: string; deadline: string; opensAt: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  return <div className="w-full max-w-sm space-y-3">
    <Button type="button" variant="primary" className="h-10 w-full gap-2 px-3 text-xs uppercase" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>
      <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
      {expanded ? "Annulla modifica scadenza" : "Cambia scadenza"}
    </Button>
    {expanded && <div id={id} className="border-[3px] border-black bg-yellow-50 p-3 shadow-brutal-sm">
      <MatchdayDateForm action={updateDeadlineFromForm.bind(null, leagueId, matchDayId)} deadline={deadline} opensAt={opensAt} />
    </div>}
  </div>
}
