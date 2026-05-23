export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  })

  const prefs = JSON.parse(user?.preferences || '{}') as Record<string, unknown>
  return NextResponse.json({ enabled: prefs.scanning_enabled !== false })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { enabled } = await req.json().catch(() => ({ enabled: true }))

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  })

  const prefs = JSON.parse(user?.preferences || '{}') as Record<string, unknown>
  await prisma.user.update({
    where: { id: session.user.id },
    data: { preferences: JSON.stringify({ ...prefs, scanning_enabled: enabled }) },
  })

  return NextResponse.json({ enabled })
}
