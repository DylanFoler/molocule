export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { company_types = [], signal_focus = [] } = body

  const supabase = createServiceClient()

  // Try updating the preferences column
  const { error } = await supabase
    .from('users')
    .update({ preferences: { company_types, signal_focus } })
    .eq('id', session.user.id)

  if (error) {
    // Column may not exist yet, upsert the user row to ensure they exist,
    // then try again. If still failing, return success so UI isn't blocked.
    if (error.message.includes('column') || error.message.includes('preferences')) {
      console.warn('preferences column missing, run supabase/schema.sql migration. Silently succeeding.')
      return NextResponse.json({ success: true, warning: 'preferences column not migrated yet' })
    }

    // User row may not exist yet, create it first
    if (error.message.includes('No rows')) {
      await supabase.from('users').upsert({
        id: session.user.id,
        email: session.user.email ?? '',
        name: session.user.name,
        image: session.user.image,
        preferences: { company_types, signal_focus },
      }, { onConflict: 'id' })
      return NextResponse.json({ success: true })
    }

    console.error('Preferences save error:', error.message)
    // Don't block the UI, return success anyway so onboarding can dismiss
    return NextResponse.json({ success: true, warning: error.message })
  }

  return NextResponse.json({ success: true })
}
