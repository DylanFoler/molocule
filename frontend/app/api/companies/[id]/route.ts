export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

function serializeCompany(c: { id: string; user_id: string; name: string; website: string; linkedin_url: string | null; github_org: string | null; blog_rss_url: string | null; created_at: Date; updated_at: Date }) {
  return { ...c, created_at: c.created_at.toISOString(), updated_at: c.updated_at.toISOString() }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [company, signals] = await Promise.all([
    prisma.company.findFirst({ where: { id, user_id: session.user.id } }),
    prisma.signal.findMany({
      where: { company_id: id },
      orderBy: { detected_at: 'desc' },
      take: 100,
    }),
  ])

  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  return NextResponse.json({
    company: serializeCompany(company),
    signals: signals.map(s => ({ ...s, detected_at: s.detected_at.toISOString(), created_at: s.created_at.toISOString() })),
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { name, website, linkedin_url, github_org, blog_rss_url } = body

  const existing = await prisma.company.findFirst({ where: { id, user_id: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const updated = await prisma.company.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(website !== undefined && { website: website.trim() }),
      ...(linkedin_url !== undefined && { linkedin_url: linkedin_url?.trim() || null }),
      ...(github_org !== undefined && { github_org: github_org?.trim() || null }),
      ...(blog_rss_url !== undefined && { blog_rss_url: blog_rss_url?.trim() || null }),
    },
  })

  return NextResponse.json(serializeCompany(updated))
}
