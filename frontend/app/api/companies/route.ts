import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('companies')
    .select(`
      *,
      signal_count:signals(count),
      latest_signal_at:signals(detected_at)
    `)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const companies = data?.map((c) => ({
    ...c,
    signal_count: (c.signal_count as unknown as [{ count: number }])?.[0]?.count ?? 0,
    latest_signal_at:
      (c.latest_signal_at as unknown as Array<{ detected_at: string }>)
        ?.sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())[0]
        ?.detected_at ?? null,
  }))

  return NextResponse.json(companies)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, website, linkedin_url, github_org, blog_rss_url } = body

  if (!name || !website) {
    return NextResponse.json({ error: 'name and website are required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('companies')
    .insert({
      user_id: session.user.id,
      name: name.trim(),
      website: website.trim(),
      linkedin_url: linkedin_url?.trim() || null,
      github_org: github_org?.trim() || null,
      blog_rss_url: blog_rss_url?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
