import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = typeof token.id === "string" ? token.id : ""
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        const record = await prisma.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true } })
        token.sessionVersion = record?.sessionVersion ?? 0
      } else if (typeof token.id === "string") {
        const record = await prisma.user.findUnique({ where: { id: token.id }, select: { sessionVersion: true } })
        // Tokens issued before this release have version zero and remain valid.
        if (!record || (token.sessionVersion ?? 0) !== record.sessionVersion) {
          token.id = undefined
        }
      }
      return token
    }
  },
  pages: {
    signIn: '/',
    newUser: '/welcome',
  }
}
