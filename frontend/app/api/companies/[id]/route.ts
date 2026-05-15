import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'

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
