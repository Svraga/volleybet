export function pageNumber(value: unknown) {
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) return 1
  return Math.min(Number(value), 100000)
}
