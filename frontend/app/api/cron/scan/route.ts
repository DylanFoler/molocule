export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { scanCompany } from '@/lib/scanner'

const BATCH_SIZE = 3
const MAX_RUNTIME_MS = 8_500

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companies = await prisma.company.findMany({
    include: { user: { select: { preferences: true } } },
  })

  // Filter to companies whose owner has scanning enabled (default: true)
  const active = companies.filter(c => {
    const prefs = JSON.parse(c.user.preferences || '{}') as Record<string, unknown>
    return prefs.scanning_enabled !== false
  })

  const startTime = Date.now()
  const results: Array<{ company: string; signals_found: number; sources: string[]; errors: string[] }> = []
  let scanned = 0

  for (let i = 0; i < active.length; i += BATCH_SIZE) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) break
    const batch = active.slice(i, i + BATCH_SIZE)
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
    total: active.length,
    skipped: companies.length - active.length,
    results,
    timestamp: new Date().toISOString(),
  })
}
