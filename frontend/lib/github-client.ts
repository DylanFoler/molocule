import { Octokit } from '@octokit/rest'
import type { PullRequest, WorkflowRun } from './types'

function getOctokit(token?: string) {
  return new Octokit({ auth: token ?? process.env.GITHUB_TOKEN })
}

export async function getRepoPRs(
  owner: string,
  repo: string,
  since: Date,
  token?: string
): Promise<PullRequest[]> {
  const octokit = getOctokit(token)
  const { data } = await octokit.pulls.list({
    owner, repo, state: 'all', sort: 'updated', direction: 'desc', per_page: 50,
  })
  return data
    .filter((pr) => new Date(pr.updated_at) >= since)
    .map((pr) => ({
      number:    pr.number,
      title:     pr.title,
      author:    pr.user?.login ?? 'unknown',
      state:     pr.merged_at ? 'merged' : (pr.state as 'open' | 'closed'),
      url:       pr.html_url,
      merged_at: pr.merged_at ?? null,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      labels:    pr.labels.map((l) => l.name ?? ''),
      body:      pr.body ?? null,
    }))
}

export async function getWorkflowRuns(
  owner: string,
  repo: string,
  since: Date,
  token?: string
): Promise<WorkflowRun[]> {
  const octokit = getOctokit(token)
  const { data } = await octokit.actions.listWorkflowRunsForRepo({
    owner, repo, per_page: 30,
    created: `>=${since.toISOString().split('T')[0]}`,
  })
  return data.workflow_runs.map((run) => ({
    id:         run.id,
    name:       run.name ?? run.workflow_id.toString(),
    status:     run.status ?? 'unknown',
    conclusion: run.conclusion ?? null,
    created_at: run.created_at,
    html_url:   run.html_url,
  }))
}

export async function getUserRepos(token: string) {
  const octokit = getOctokit(token)
  const { data } = await octokit.repos.listForAuthenticatedUser({
    sort: 'updated', per_page: 100, type: 'all',
  })
  return data.map((repo) => ({
    id: repo.id, full_name: repo.full_name,
    owner: repo.owner.login, name: repo.name, private: repo.private,
  }))
}

export async function getContributors(
  _owner: string, _repo: string, prs: PullRequest[]
): Promise<string[]> {
  return Array.from(new Set(prs.map((pr) => pr.author).filter(Boolean))).slice(0, 10)
}

export function classifyPRSize(additions: number, deletions: number): 'xs' | 's' | 'm' | 'l' {
  const total = additions + deletions
  if (total < 10)  return 'xs'
  if (total < 100) return 's'
  if (total < 500) return 'm'
  return 'l'
}

export interface DigestMetrics {
  avg_cycle_time_hours: number | null
  avg_review_time_hours: number | null
  pr_size_distribution: { xs: number; s: number; m: number; l: number }
  stale_pr_count: number
  failed_job_names: string[]
}

// Computes metrics from data we already fetched — no extra API calls per PR.
// Failed job names require one call per failed run (capped at 3).
export async function computeDigestMetrics(
  prs: PullRequest[],
  workflowRuns: WorkflowRun[],
  owner: string,
  repo: string,
  token?: string
): Promise<DigestMetrics> {
  // Cycle time: merged_at - created_at (already have this data)
  const cycleTimes = prs
    .filter((p) => p.state === 'merged' && p.merged_at && p.created_at)
    .map((p) => (new Date(p.merged_at!).getTime() - new Date(p.created_at).getTime()) / 3_600_000)
    .filter((h) => h >= 0)

  // Stale: open PRs with no activity in 7+ days
  const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const stale_pr_count = prs.filter(
    (p) => p.state === 'open' && p.updated_at && new Date(p.updated_at) < staleThreshold
  ).length

  // Failed job names: max 3 runs, one API call each
  const failedRuns = workflowRuns.filter((r) => r.conclusion === 'failure').slice(0, 3)
  const jobResults = await Promise.allSettled(
    failedRuns.map((r) => getFailedJobNames(owner, repo, r.id, token))
  )
  const failed_job_names = Array.from(new Set(
    jobResults.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  ))

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

  return {
    avg_cycle_time_hours:  avg(cycleTimes),
    avg_review_time_hours: null, // requires per-PR API calls — skipped to avoid timeout
    pr_size_distribution:  { xs: 0, s: 0, m: 0, l: 0 }, // requires per-PR API calls — skipped
    stale_pr_count,
    failed_job_names,
  }
}

async function getFailedJobNames(
  owner: string, repo: string, runId: number, token?: string
): Promise<string[]> {
  try {
    const octokit = getOctokit(token)
    const { data } = await octokit.actions.listJobsForWorkflowRun({
      owner, repo, run_id: runId, per_page: 30,
    })
    return data.jobs.filter((j) => j.conclusion === 'failure').map((j) => j.name)
  } catch {
    return []
  }
}
