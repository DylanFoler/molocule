import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { LoginPage } from '@/components/login-page'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')
  return <LoginPage />
}
