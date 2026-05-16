import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // Verify ownership: digest must belong to a repo owned by this user
  const { data: digest } = await supabase
    .from('digests')
    .select('id, repo:repos!inner(user_id)')
    .eq('id', id)
    .single()

  if (!digest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const repoData = digest.repo as unknown as { user_id: string }
  if (repoData.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('digests').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
