export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { name, website, linkedin_url, github_org, blog_rss_url } = body

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('companies')
    .update({
      ...(name       !== undefined && { name: name.trim() }),
      ...(website    !== undefined && { website: website.trim() }),
      ...(linkedin_url !== undefined && { linkedin_url: linkedin_url?.trim() || null }),
      ...(github_org !== undefined && { github_org: github_org?.trim() || null }),
      ...(blog_rss_url !== undefined && { blog_rss_url: blog_rss_url?.trim() || null }),
    })
    .eq('id', id)
    .eq('user_id', session.user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const [companyRes, signalsRes] = await Promise.all([
    supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single(),
    supabase
      .from('signals')
      .select('*')
      .eq('company_id', id)
      .order('detected_at', { ascending: false })
      .limit(100),
  ])

  if (companyRes.error || !companyRes.data) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  return NextResponse.json({
    company: companyRes.data,
    signals: signalsRes.data ?? [],
  })
}
