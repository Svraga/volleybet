import { getToken } from "next-auth/jwt"
import { NextResponse, type NextRequest } from "next/server"

export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/league") || request.nextUrl.pathname.startsWith("/profile")) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (typeof token?.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(token.id)) {
      const login = new URL("/", request.url)
      login.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search)
      return NextResponse.redirect(login)
    }
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // The guided tour positions its popovers inline.
    `connect-src 'self'${process.env.NODE_ENV === "development" ? " ws: wss:" : ""}`,
    "img-src 'self' data: blob:", "font-src 'self'", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join("; ")
  const headers = new Headers(request.headers)
  headers.set("x-nonce", nonce)
  headers.set("Content-Security-Policy", csp)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set("Content-Security-Policy", csp)
  return response
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)"] }
