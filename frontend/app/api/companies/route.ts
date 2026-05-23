export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

function serializeCompany(c: {
  id: string; user_id: string; name: string; website: string
  linkedin_url: string | null; github_org: string | null; blog_rss_url: string | null
  created_at: Date; updated_at: Date
  signals?: { detected_at: Date }[]
}) {
  const signals = c.signals ?? []
  const sorted = [...signals].sort((a, b) => b.detected_at.getTime() - a.detected_at.getTime())
  return {
    id: c.id, user_id: c.user_id, name: c.name, website: c.website,
    linkedin_url: c.linkedin_url, github_org: c.github_org, blog_rss_url: c.blog_rss_url,
    created_at: c.created_at.toISOString(), updated_at: c.updated_at.toISOString(),
    signal_count: signals.length,
    latest_signal_at: sorted[0]?.detected_at.toISOString() ?? null,
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companies = await prisma.company.findMany({
    where: { user_id: session.user.id },
    include: { signals: { select: { detected_at: true } } },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(companies.map(serializeCompany), {
    headers: { 'Cache-Control': 'private, no-cache' },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, website, linkedin_url, github_org, blog_rss_url } = body

  if (!name || !website || typeof name !== 'string' || typeof website !== 'string') {
    return NextResponse.json({ error: 'name and website are required strings' }, { status: 400 })
  }

  // Ensure user row exists (created on first sign-in, but guard anyway)
  await prisma.user.upsert({
    where: { id: session.user.id },
    update: {},
    create: { id: session.user.id, email: session.user.email ?? '', name: session.user.name, image: session.user.image },
  })

  const company = await prisma.company.create({
    data: {
      user_id: session.user.id,
      name: name.trim(),
      website: website.trim(),
      linkedin_url: linkedin_url?.trim() || null,
      github_org: github_org?.trim() || null,
      blog_rss_url: blog_rss_url?.trim() || null,
    },
  })

  return NextResponse.json(serializeCompany({ ...company, signals: [] }), { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.company.deleteMany({ where: { id, user_id: session.user.id } })
  return NextResponse.json({ success: true })
}
