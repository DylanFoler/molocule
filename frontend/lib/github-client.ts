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
      number: pr.number,
      title: pr.title,
      author: pr.user?.login ?? 'unknown',
      state: pr.merged_at ? 'merged' : (pr.state as 'open' | 'closed'),
      url: pr.html_url,
      merged_at: pr.merged_at ?? null,
      created_at: pr.created_at,
      labels: pr.labels.map((l) => l.name ?? ''),
      body: pr.body ?? null,
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
    id: run.id,
    name: run.name ?? run.workflow_id.toString(),
    status: run.status ?? 'unknown',
    conclusion: run.conclusion ?? null,
    created_at: run.created_at,
    html_url: run.html_url,
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
    id: repo.id,
    full_name: repo.full_name,
    owner: repo.owner.login,
    name: repo.name,
    private: repo.private,
  }))
}

export async function getContributors(
  owner: string,
  repo: string,
  prs: PullRequest[]
): Promise<string[]> {
  const authors = Array.from(new Set(prs.map((pr) => pr.author).filter(Boolean)))
  return authors.slice(0, 10)
}
