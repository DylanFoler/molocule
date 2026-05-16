export type SignalType = 'FUNDING' | 'KEY_HIRE' | 'LAYOFF' | 'PRODUCT_LAUNCH' | 'GENERAL'

export type CompanyType =
  | 'SaaS' | 'FinTech' | 'DevTools' | 'E-commerce'
  | 'Healthcare' | 'Enterprise' | 'Crypto/Web3' | 'Consumer'

export type SignalFocus = 'Funding' | 'Key Hires' | 'Product Launches' | 'Layoffs' | 'All'

export interface UserPreferences {
  company_types: CompanyType[]
  signal_focus: SignalFocus[]
}

export interface CompanyEnrichment {
  name: string
  website: string
  description: string | null
  github_org: string | null
  blog_rss_url: string | null
  favicon_url: string | null
  linkedin_url: string | null
  found: { github: boolean; rss: boolean; linkedin: boolean }
}

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
