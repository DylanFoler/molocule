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
    owner,
    repo,
    state: 'all',
    sort: 'updated',
    direction: 'desc',
    per_page: 50,
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
    owner,
    repo,
    per_page: 30,
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

export async function getUserRepos(token: string): Promise<
  Array<{ id: number; full_name: string; owner: string; name: string; private: boolean }>
> {
  const octokit = getOctokit(token)
  const { data } = await octokit.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 100,
    type: 'all',
  })
  return data.map((repo) => ({
    id:        repo.id,
    full_name: repo.full_name,
    owner:     repo.owner.login,
    name:      repo.name,
    private:   repo.private,
  }))
}

export async function getContributors(
  _owner: string,
  _repo: string,
  prs: PullRequest[]
): Promise<string[]> {
  return Array.from(new Set(prs.map((pr) => pr.author).filter(Boolean))).slice(0, 10)
}

export async function getPRDetails(
  owner: string,
  repo: string,
  prNumber: number,
  token?: string
): Promise<{ additions: number; deletions: number }> {
  try {
    const octokit = getOctokit(token)
    const { data } = await octokit.pulls.get({ owner, repo, pull_number: prNumber })
    return { additions: data.additions, deletions: data.deletions }
  } catch {
    return { additions: 0, deletions: 0 }
  }
}

export async function getFirstReviewTime(
  owner: string,
  repo: string,
  prNumber: number,
  token?: string
): Promise<string | null> {
  try {
    const octokit = getOctokit(token)
    const { data } = await octokit.pulls.listReviews({ owner, repo, pull_number: prNumber, per_page: 10 })
    const first = data.find((r) => r.submitted_at)
    return first?.submitted_at ?? null
  } catch {
    return null
  }
}

export async function getFailedJobNames(
  owner: string,
  repo: string,
  runId: number,
  token?: string
): Promise<string[]> {
  try {
    const octokit = getOctokit(token)
    const { data } = await octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
      per_page: 30,
    })
    return data.jobs
      .filter((j) => j.conclusion === 'failure')
      .map((j) => j.name)
  } catch {
    return []
  }
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

export async function computeDigestMetrics(
  prs: PullRequest[],
  workflowRuns: WorkflowRun[],
  owner: string,
  repo: string,
  token?: string
): Promise<DigestMetrics> {
  const mergedPRs = prs.filter((p) => p.state === 'merged' && p.merged_at).slice(0, 20)
  const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const stale_pr_count = prs.filter(
    (p) => p.state === 'open' && p.updated_at && new Date(p.updated_at) < staleThreshold
  ).length

  // Fetch PR details and first review times in parallel, batched at 5 at a time
  const sizeBuckets = { xs: 0, s: 0, m: 0, l: 0 }
  const cycleTimes: number[] = []
  const reviewTimes: number[] = []

  for (let i = 0; i < mergedPRs.length; i += 5) {
    const batch = mergedPRs.slice(i, i + 5)
    const results = await Promise.allSettled(
      batch.map(async (pr) => {
        const [details, firstReview] = await Promise.allSettled([
          getPRDetails(owner, repo, pr.number, token),
          getFirstReviewTime(owner, repo, pr.number, token),
        ])

        if (details.status === 'fulfilled') {
          const { additions, deletions } = details.value
          const bucket = classifyPRSize(additions, deletions)
          sizeBuckets[bucket]++
        }

        if (pr.merged_at && pr.created_at) {
          const hours = (new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime()) / 3_600_000
          if (hours >= 0) cycleTimes.push(hours)
        }

        if (firstReview.status === 'fulfilled' && firstReview.value && pr.created_at) {
          const hours = (new Date(firstReview.value).getTime() - new Date(pr.created_at).getTime()) / 3_600_000
          if (hours >= 0) reviewTimes.push(hours)
        }
      })
    )
    // results intentionally unused - side effects collected above
    void results
  }

  // Fetch failed job names for up to 5 failed runs
  const failedRuns = workflowRuns.filter((r) => r.conclusion === 'failure').slice(0, 5)
  const jobNameArrays = await Promise.allSettled(
    failedRuns.map((r) => getFailedJobNames(owner, repo, r.id, token))
  )
  const failed_job_names = Array.from(new Set(
    jobNameArrays.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  ))

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

  return {
    avg_cycle_time_hours:  avg(cycleTimes),
    avg_review_time_hours: avg(reviewTimes),
    pr_size_distribution:  sizeBuckets,
    stale_pr_count,
    failed_job_names,
  }
}
