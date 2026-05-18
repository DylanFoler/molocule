export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('users')
    .select('preferences')
    .eq('id', session.user.id)
    .single()

  const enabled = (data?.preferences as Record<string, unknown>)?.scanning_enabled !== false
  return NextResponse.json({ enabled })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { enabled } = await req.json().catch(() => ({ enabled: true }))
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('users')
    .select('preferences')
    .eq('id', session.user.id)
    .single()

  const prefs = (existing?.preferences as Record<string, unknown>) ?? {}
  await supabase
    .from('users')
    .update({ preferences: { ...prefs, scanning_enabled: enabled } })
    .eq('id', session.user.id)

  return NextResponse.json({ enabled })
}
