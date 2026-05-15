import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getRepoPRs, getWorkflowRuns, getContributors, computeDigestMetrics } from '@/lib/github-client'
import { summarizePRDigest, generateKeyChanges, generateReleaseNotes } from '@/lib/claude'
import { subDays } from 'date-fns'

// Called by GitHub Actions weekly — secured by CRON_SECRET
// Generates digests for all users using their stored GitHub token
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: repos } = await supabase
    .from('repos')
    .select('*, user:users(id, github_access_token)')

  if (!repos?.length) return NextResponse.json({ digested: 0 })

  const periodEnd   = new Date()
  const periodStart = subDays(periodEnd, 7)
  const results: Array<{ repo: string; ok: boolean; error?: string }> = []

  for (const repo of repos) {
    const token = (repo.user as { github_access_token?: string } | null)?.github_access_token ?? undefined
    try {
      const [prs, workflowRuns] = await Promise.all([
        getRepoPRs(repo.owner, repo.name, periodStart, token).catch(() => []),
        getWorkflowRuns(repo.owner, repo.name, periodStart, token).catch(() => []),
      ])

      const contributors = await getContributors(repo.owner, repo.name, prs)
      const [summary, keyChanges, metrics, releaseNotes] = await Promise.all([
        summarizePRDigest({ repoFullName: repo.full_name, prs, workflowRuns, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() }),
        generateKeyChanges(prs),
        computeDigestMetrics(prs, workflowRuns, repo.owner, repo.name, token).catch(() => ({ avg_cycle_time_hours: null, avg_review_time_hours: null, pr_size_distribution: { xs: 0, s: 0, m: 0, l: 0 }, stale_pr_count: 0, failed_job_names: [] })),
        generateReleaseNotes(prs),
      ])

      await supabase.from('digests').insert({
        repo_id: repo.id,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        summary, pr_count: prs.length,
        merged_count: prs.filter(p => p.state === 'merged').length,
        open_count: prs.filter(p => p.state === 'open').length,
        raw_data: { prs, workflow_runs: workflowRuns, contributors, key_changes: keyChanges },
        avg_cycle_time_hours: metrics.avg_cycle_time_hours,
        avg_review_time_hours: metrics.avg_review_time_hours,
        pr_size_distribution: metrics.pr_size_distribution,
        stale_pr_count: metrics.stale_pr_count,
        failed_job_names: metrics.failed_job_names,
        release_notes: releaseNotes || null,
      })

      results.push({ repo: repo.full_name, ok: true })
    } catch (err) {
      results.push({ repo: repo.full_name, ok: false, error: String(err) })
    }
  }

  return NextResponse.json({ digested: results.filter(r => r.ok).length, results, timestamp: new Date().toISOString() })
}
