import { withAuth } from "next-auth/middleware"

export default withAuth({
  callbacks: { authorized: ({ token }) => typeof token?.id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(token.id) },
  pages: {
    signIn: "/",
  },
})

export const config = { matcher: ["/league/:path*", "/profile/:path*"] }
