import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'
import { getRepoPRs, getWorkflowRuns, getContributors } from '@/lib/github-client'
import { summarizePRDigest, generateKeyChanges } from '@/lib/claude'
import { subDays } from 'date-fns'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('digests')
    .select('*, repo:repos(*)')
    .eq('repos.user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { repo_id, days = 7 } = await req.json()
  if (!repo_id) return NextResponse.json({ error: 'repo_id required' }, { status: 400 })

  const supabase = createServiceClient()

  // Verify repo belongs to user
  const { data: repo, error: repoErr } = await supabase
    .from('repos')
    .select('*')
    .eq('id', repo_id)
    .eq('user_id', session.user.id)
    .single()

  if (repoErr || !repo) return NextResponse.json({ error: 'Repo not found' }, { status: 404 })

  const periodEnd = new Date()
  const periodStart = subDays(periodEnd, days)

  try {
    const [prs, workflowRuns] = await Promise.all([
      getRepoPRs(repo.owner, repo.name, periodStart, session.user.accessToken),
      getWorkflowRuns(repo.owner, repo.name, periodStart, session.user.accessToken),
    ])

    const contributors = await getContributors(repo.owner, repo.name, prs)
    const [summary, keyChanges] = await Promise.all([
      summarizePRDigest({
        repoFullName: repo.full_name,
        prs,
        workflowRuns,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      }),
      generateKeyChanges(prs),
    ])

    const rawData = { prs, workflow_runs: workflowRuns, contributors, key_changes: keyChanges }

    const { data: digest, error: digestErr } = await supabase
      .from('digests')
      .insert({
        repo_id,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        summary,
        pr_count: prs.length,
        merged_count: prs.filter((p) => p.state === 'merged').length,
        open_count: prs.filter((p) => p.state === 'open').length,
        raw_data: rawData,
      })
      .select('*, repo:repos(*)')
      .single()

    if (digestErr) return NextResponse.json({ error: digestErr.message }, { status: 500 })
    return NextResponse.json(digest, { status: 201 })
  } catch (err) {
    console.error('Digest generation error:', err)
    return NextResponse.json({ error: 'Failed to generate digest' }, { status: 500 })
  }
}
