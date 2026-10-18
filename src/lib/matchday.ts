export type DayWindow = { status: string; deadline: Date; opensAt?: Date | null }

export function isDayScheduled(day: DayWindow, now = Date.now()) {
  return day.status === "OPEN" && !!day.opensAt && day.opensAt.getTime() > now && day.deadline.getTime() > now
}

export function isDayClosed(day: DayWindow, now = Date.now()) {
  return day.status === "CLOSED" || day.status === "SCORED" || day.deadline.getTime() <= now
}

export function isDayOpen(day: DayWindow, now = Date.now()) {
  return day.status === "OPEN" && !isDayScheduled(day, now) && !isDayClosed(day, now)
}

export class ScheduleError extends Error {}

// Only accept instants with an explicit timezone. datetime-local must be converted
// in the browser so the server's timezone cannot shift the chosen opening time.
export function futureDate(raw: string, label: string, now = Date.now()) {
  const date = new Date(raw)
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(raw)
  const calendarValid = parts && Number(parts[2]) >= 1 && Number(parts[2]) <= 12 && Number(parts[3]) >= 1
    && Number(parts[3]) <= new Date(Date.UTC(Number(parts[1]), Number(parts[2]), 0)).getUTCDate()
    && Number(parts[4]) <= 23 && Number(parts[5]) <= 59 && Number(parts[6] || 0) <= 59
  if (!calendarValid || !Number.isFinite(date.getTime()) || date.getTime() <= now) {
    throw new ScheduleError(`${label}: scegli una data e un orario futuri validi.`)
  }
  return date
}

export function assertDayEditable(day: DayWindow) {
  if (day.status !== "OPEN" || isDayClosed(day)) throw new Error("La giornata è chiusa o la scadenza è superata")
}
