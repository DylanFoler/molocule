export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { scanCompany } from '@/lib/scanner'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, website, blog_rss_url')

  if (error || !companies) {
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }

  const results = await Promise.all(companies.map(c => scanCompany(c).catch(() => ({ signals_found: 0, sources: [], errors: [] }))))

  return NextResponse.json({
    scanned: companies.length,
    results: companies.map((c, i) => ({ company: c.name, ...results[i] })),
    timestamp: new Date().toISOString(),
  })
}
