export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'
import { scanCompany } from '@/lib/scanner'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const company = await prisma.company.findFirst({
    where: { id, user_id: session.user.id },
    select: { id: true, name: true, website: true, blog_rss_url: true },
  })

  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const result = await scanCompany(company)
  return NextResponse.json(result)
}
