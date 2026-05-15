import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'
import { scanCompany } from '@/lib/scanner'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, website, blog_rss_url')
    .eq('user_id', session.user.id)

  if (error || !companies?.length) {
    return NextResponse.json({ scanned: 0, total_found: 0 })
  }

  const results = await Promise.all(companies.map(c => scanCompany(c).catch(() => ({ signals_found: 0, sources: [], errors: [] }))))
  const total_found = results.reduce((sum, r) => sum + r.signals_found, 0)

  return NextResponse.json({
    scanned: companies.length,
    total_found,
    results: companies.map((c, i) => ({ company: c.name, ...results[i] })),
  })
}
