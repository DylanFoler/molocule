import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'
import { getRepoPRs, getWorkflowRuns, getContributors, computeDigestMetrics } from '@/lib/github-client'
import { summarizePRDigest, generateKeyChanges, generateReleaseNotes } from '@/lib/claude'
import { subDays } from 'date-fns'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('digests')
    .select('*, repo:repos!inner(*)')
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

  const { data: repo, error: repoErr } = await supabase
    .from('repos')
    .select('*')
    .eq('id', repo_id)
    .eq('user_id', session.user.id)
    .single()

  if (repoErr || !repo) {
    return NextResponse.json({ error: `Repo not found: ${repoErr?.message}` }, { status: 404 })
  }

  const periodEnd   = new Date()
  const periodStart = subDays(periodEnd, days)

  // Fetch PRs and workflow runs
  const [prs, workflowRuns] = await Promise.all([
    getRepoPRs(repo.owner, repo.name, periodStart, session.user.accessToken).catch((e) => {
      console.error('getRepoPRs failed:', e?.message)
      return []
    }),
    getWorkflowRuns(repo.owner, repo.name, periodStart, session.user.accessToken).catch((e) => {
      console.error('getWorkflowRuns failed:', e?.message)
      return []
    }),
  ])

  const contributors = await getContributors(repo.owner, repo.name, prs)

  // Run AI + metrics in parallel — each has its own fallback
  const [summary, keyChanges, metrics, releaseNotes] = await Promise.all([
    summarizePRDigest({
      repoFullName: repo.full_name, prs, workflowRuns,
      periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(),
    }),
    generateKeyChanges(prs),
    computeDigestMetrics(prs, workflowRuns, repo.owner, repo.name, session.user.accessToken).catch((e) => {
      console.error('computeDigestMetrics failed:', e?.message)
      return { avg_cycle_time_hours: null, avg_review_time_hours: null,
        pr_size_distribution: { xs: 0, s: 0, m: 0, l: 0 }, stale_pr_count: 0, failed_job_names: [] }
    }),
    generateReleaseNotes(prs),
  ])

  const rawData = { prs, workflow_runs: workflowRuns, contributors, key_changes: keyChanges }

  // Try inserting with new metric columns first
  const baseInsert = {
    repo_id,
    period_start:  periodStart.toISOString(),
    period_end:    periodEnd.toISOString(),
    summary,
    pr_count:      prs.length,
    merged_count:  prs.filter((p) => p.state === 'merged').length,
    open_count:    prs.filter((p) => p.state === 'open').length,
    raw_data:      rawData,
  }

  const fullInsert = {
    ...baseInsert,
    avg_cycle_time_hours:  metrics.avg_cycle_time_hours,
    avg_review_time_hours: metrics.avg_review_time_hours,
    pr_size_distribution:  metrics.pr_size_distribution,
    stale_pr_count:        metrics.stale_pr_count,
    failed_job_names:      metrics.failed_job_names,
    release_notes:         releaseNotes || null,
  }

  let { data: digest, error: digestErr } = await supabase
    .from('digests').insert(fullInsert).select('*, repo:repos(*)').single()

  // If new columns don't exist yet (schema migration not run), fall back to base insert
  if (digestErr && digestErr.message.includes('column')) {
    console.warn('New digest columns missing in DB — falling back to base insert. Run supabase/schema.sql to enable metrics.')
    const fallback = await supabase
      .from('digests').insert(baseInsert).select('*, repo:repos(*)').single()
    digest = fallback.data
    digestErr = fallback.error
  }

  if (digestErr) {
    console.error('Digest insert failed:', digestErr.message)
    return NextResponse.json({ error: digestErr.message }, { status: 500 })
  }

  return NextResponse.json(digest, { status: 201 })
}
