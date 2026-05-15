export type SignalType = 'FUNDING' | 'KEY_HIRE' | 'LAYOFF' | 'PRODUCT_LAUNCH' | 'GENERAL'

export interface Company {
  id: string
  user_id: string
  name: string
  website: string
  linkedin_url: string | null
  github_org: string | null
  blog_rss_url: string | null
  created_at: string
  signal_count?: number
  latest_signal_at?: string | null
}

export interface Signal {
  id: string
  company_id: string
  company?: Company
  type: SignalType
  title: string
  url: string | null
  summary: string | null
  llm_insight: string | null
  is_new: boolean
  detected_at: string
  created_at: string
}

export interface Repo {
  id: string
  user_id: string
  github_repo_id: string
  owner: string
  name: string
  full_name: string
  connected_at: string
  latest_digest?: Digest | null
}

export interface Digest {
  id: string
  repo_id: string
  repo?: Repo
  period_start: string
  period_end: string
  summary: string
  pr_count: number
  merged_count: number
  open_count: number
  raw_data: DigestRawData
  created_at: string
}

export interface DigestRawData {
  prs: PullRequest[]
  workflow_runs: WorkflowRun[]
  contributors: string[]
  key_changes: string[]
}

export interface PullRequest {
  number: number
  title: string
  author: string
  state: 'open' | 'closed' | 'merged'
  url: string
  merged_at: string | null
  created_at: string
  labels: string[]
  body: string | null
}

export interface WorkflowRun {
  id: number
  name: string
  status: string
  conclusion: string | null
  created_at: string
  html_url: string
}

export interface Notification {
  id: string
  user_id: string
  slack_webhook_url: string | null
  email: string | null
  digest_frequency: 'daily' | 'weekly'
  created_at: string
}

export interface DashboardStats {
  total_companies: number
  active_signals: number
  new_signals_today: number
  connected_repos: number
  digests_generated: number
}

export const SIGNAL_LABELS: Record<SignalType, string> = {
  FUNDING: 'Funding',
  KEY_HIRE: 'Key Hire',
  LAYOFF: 'Layoff',
  PRODUCT_LAUNCH: 'Product Launch',
  GENERAL: 'General',
}

export const SIGNAL_COLORS: Record<SignalType, string> = {
  FUNDING: 'signal-funding',
  KEY_HIRE: 'signal-hire',
  LAYOFF: 'signal-layoff',
  PRODUCT_LAUNCH: 'signal-launch',
  GENERAL: 'signal-general',
}
