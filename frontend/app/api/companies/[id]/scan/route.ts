import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'
import { scanCompany } from '@/lib/scanner'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: company, error } = await supabase
    .from('companies')
    .select('id, name, website, blog_rss_url')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()

  if (error || !company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const result = await scanCompany(company)
  return NextResponse.json(result)
}
