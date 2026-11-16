// Only internal league invites are accepted as login return destinations.
export function safeCallbackPath(value: unknown, baseUrl?: string) {
  if (typeof value !== "string" || value.length > 512) return "/"
  if (baseUrl && /^https?:\/\//.test(value)) {
    try {
      const target = new URL(value)
      if (target.origin !== new URL(baseUrl).origin) return "/"
      value = target.pathname + target.search
    } catch { return "/" }
  }
  if (typeof value !== "string") return "/"
  if (value === "/" || value === "/profile") return value
  if (/^\/league\/join(?:\?code=VOLLEY-[0-9A-F]{32})?$/.test(value)) return value
  return "/"
}
