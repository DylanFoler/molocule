import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { LoginPage } from '@/components/login-page'

export default async function Home() {
  let session = null
  try {
    session = await getServerSession(authOptions)
  } catch { /* stale / invalid JWT cookie — treat as unauthenticated */ }
  if (session) redirect('/dashboard')
  return <LoginPage />
}
