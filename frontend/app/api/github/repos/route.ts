import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getUserRepos } from '@/lib/github-client'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const repos = await getUserRepos(session.user.accessToken!)
    return NextResponse.json(repos)
  } catch (err) {
    console.error('GitHub repos fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch repos from GitHub' }, { status: 500 })
  }
}
