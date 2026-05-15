import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'
import type { SignalType } from '@/lib/types'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as SignalType | null
  const companyId = searchParams.get('company_id')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const supabase = createServiceClient()

  // !inner turns the join into an inner join so only signals belonging
  // to the current user's companies are returned (not all signals)
  let query = supabase
    .from('signals')
    .select('*, company:companies!inner(*)')
    .eq('companies.user_id', session.user.id)
    .order('detected_at', { ascending: false })
    .limit(limit)

  if (type) query = query.eq('type', type)
  if (companyId) query = query.eq('company_id', companyId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark viewed signals as not new
  const newIds = data?.filter((s) => s.is_new).map((s) => s.id) ?? []
  if (newIds.length > 0) {
    await supabase.from('signals').update({ is_new: false }).in('id', newIds)
  }

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  // Internal endpoint for workers to push signals — secured by CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { company_id, type, title, url, summary, llm_insight } = body

  if (!company_id || !type || !title) {
    return NextResponse.json({ error: 'company_id, type, and title are required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Deduplication: skip if same title seen in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: existing } = await supabase
    .from('signals')
    .select('id')
    .eq('company_id', company_id)
    .eq('title', title)
    .gte('detected_at', sevenDaysAgo)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ skipped: true, reason: 'duplicate' })
  }

  const { data, error } = await supabase
    .from('signals')
    .insert({ company_id, type, title, url, summary, llm_insight, is_new: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
