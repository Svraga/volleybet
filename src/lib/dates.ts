export function italianDateTime(value: Date | string, seconds = false) {
  return new Date(value).toLocaleString("it-IT", {
    timeZone: "Europe/Rome", dateStyle: "short", timeStyle: seconds ? "medium" : "short",
  })
}
