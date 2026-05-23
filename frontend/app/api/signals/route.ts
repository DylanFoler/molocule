export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'
import type { SignalType } from '@/lib/types'

function serializeSignal(s: {
  id: string; company_id: string; type: string; title: string; url: string | null
  summary: string | null; llm_insight: string | null; is_new: boolean
  detected_at: Date; created_at: Date
  company?: { id: string; user_id: string; name: string; website: string; linkedin_url: string | null; github_org: string | null; blog_rss_url: string | null; created_at: Date; updated_at: Date }
}) {
  return {
    ...s,
    detected_at: s.detected_at.toISOString(),
    created_at: s.created_at.toISOString(),
    company: s.company ? {
      ...s.company,
      created_at: s.company.created_at.toISOString(),
      updated_at: s.company.updated_at.toISOString(),
    } : undefined,
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as SignalType | null
  const companyId = searchParams.get('company_id')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const signals = await prisma.signal.findMany({
    where: {
      company: { user_id: session.user.id },
      ...(type ? { type } : {}),
      ...(companyId ? { company_id: companyId } : {}),
    },
    include: { company: true },
    orderBy: { detected_at: 'desc' },
    take: limit,
  })

  // Mark viewed signals as not new
  const newIds = signals.filter(s => s.is_new).map(s => s.id)
  if (newIds.length > 0) {
    await prisma.signal.updateMany({ where: { id: { in: newIds } }, data: { is_new: false } })
  }

  return NextResponse.json(signals.map(serializeSignal), {
    headers: { 'Cache-Control': 'private, no-cache' },
  })
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { company_id, type, title, url, summary, llm_insight } = body

  if (!company_id || !type || !title) {
    return NextResponse.json({ error: 'company_id, type, and title are required' }, { status: 400 })
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const existing = await prisma.signal.findFirst({
    where: { company_id, title, detected_at: { gte: sevenDaysAgo } },
  })
  if (existing) return NextResponse.json({ skipped: true, reason: 'duplicate' })

  const signal = await prisma.signal.create({
    data: { company_id, type, title, url, summary, llm_insight, is_new: true },
  })

  return NextResponse.json(serializeSignal(signal), { status: 201 })
}
