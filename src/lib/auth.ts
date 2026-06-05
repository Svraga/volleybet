import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    // Mock Provider for local testing
    CredentialsProvider({
      name: "Mock Login",
      credentials: {
        name: { label: "Username", type: "text", placeholder: "mario.rossi" },
      },
      async authorize(credentials) {
        if (!credentials?.name) return null
        
        // Find or create user
        let user = await prisma.user.findFirst({
          where: { name: credentials.name }
        })
        
        if (!user) {
          user = await prisma.user.create({
            data: {
              name: credentials.name,
              email: `${credentials.name.toLowerCase().replace(" ", ".")}@mock.local`,
            }
          })
        }
        
        return {
          id: user.id,
          name: user.name,
          email: user.email,
        }
      }
    }),
    
    // Real Google Provider (active if env vars are present)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    }
  },
  pages: {
    signIn: '/',
  }
}
