export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { company_types = [], signal_focus = [] } = body

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  })

  const existing = JSON.parse(user?.preferences || '{}') as Record<string, unknown>
  await prisma.user.update({
    where: { id: session.user.id },
    data: { preferences: JSON.stringify({ ...existing, company_types, signal_focus }) },
  })

  return NextResponse.json({ success: true })
}
