import NextAuth, { type NextAuthOptions } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import { prisma } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: { scope: 'read:user user:email repo' },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false

      try {
        await prisma.user.upsert({
          where: { id: user.id },
          update: {
            email: user.email,
            name: user.name,
            image: user.image,
            github_access_token: account?.access_token,
          },
          create: {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            github_access_token: account?.access_token,
          },
        })
      } catch (e) {
        console.error('[signIn] User upsert error:', e)
      }

      return true
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
        session.user.accessToken = token.accessToken as string
      }
      return session
    },

    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  session: { strategy: 'jwt' },
  logger: {
    error(code, metadata) {
      if (code === 'JWT_SESSION_ERROR') return
      console.error('[next-auth]', code, metadata)
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
