import NextAuth, { type NextAuthOptions } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import { createServiceClient } from '@/lib/supabase'

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
        const supabase = createServiceClient()
        const { error } = await supabase.from('users').upsert(
          {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            github_access_token: account?.access_token,
          },
          { onConflict: 'id' }
        )
        if (error) console.error('[signIn] Supabase upsert error:', error.message)
      } catch (e) {
        console.error('[signIn] Unexpected error:', e)
      }

      // Always allow sign-in — Supabase sync failure should not block access
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
