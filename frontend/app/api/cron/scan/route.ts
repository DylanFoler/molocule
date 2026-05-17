export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { scanCompany } from '@/lib/scanner'

const BATCH_SIZE = 3
const MAX_RUNTIME_MS = 8_500 // stop before Vercel hobby's 10s hard limit

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

  const startTime = Date.now()
  const results: Array<{ company: string; signals_found: number; sources: string[]; errors: string[] }> = []
  let scanned = 0

  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) break
    const batch = companies.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(c => scanCompany(c).catch(() => ({ signals_found: 0, sources: [], errors: [] })))
    )
    for (let j = 0; j < batch.length; j++) {
      results.push({ company: batch[j].name, ...batchResults[j] })
    }
    scanned += batch.length
  }

  return NextResponse.json({
    scanned,
    total: companies.length,
    results,
    timestamp: new Date().toISOString(),
  })
}
