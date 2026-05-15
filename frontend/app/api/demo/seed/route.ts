import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'

const DEMO_COMPANIES = [
  { name: 'Stripe',    website: 'https://stripe.com',    github_org: 'stripe',       linkedin_url: 'https://www.linkedin.com/company/stripe',           blog_rss_url: 'https://stripe.com/blog/feed/rss' },
  { name: 'Vercel',    website: 'https://vercel.com',    github_org: 'vercel',       linkedin_url: 'https://www.linkedin.com/company/vercel',            blog_rss_url: 'https://vercel.com/atom' },
  { name: 'Anthropic', website: 'https://anthropic.com', github_org: 'anthropics',   linkedin_url: 'https://www.linkedin.com/company/anthropicresearch', blog_rss_url: 'https://www.anthropic.com/rss.xml' },
  { name: 'Linear',    website: 'https://linear.app',    github_org: 'linear',       linkedin_url: 'https://www.linkedin.com/company/linear-app',        blog_rss_url: 'https://linear.app/blog/rss.xml' },
  { name: 'Rippling',  website: 'https://rippling.com',  github_org: 'rippling',     linkedin_url: 'https://www.linkedin.com/company/rippling',          blog_rss_url: 'https://www.rippling.com/blog/rss' },
  { name: 'Brex',      website: 'https://brex.com',      github_org: 'brexhq',       linkedin_url: 'https://www.linkedin.com/company/brex-hq',           blog_rss_url: 'https://www.brex.com/blog/rss' },
  { name: 'Notion',    website: 'https://notion.so',     github_org: 'makenotion',   linkedin_url: 'https://www.linkedin.com/company/notionhq',          blog_rss_url: 'https://www.notion.so/blog/rss' },
  { name: 'Figma',     website: 'https://figma.com',     github_org: 'figma',        linkedin_url: 'https://www.linkedin.com/company/figma',             blog_rss_url: 'https://www.figma.com/blog/rss.xml' },
]

const DAY = 24 * 60 * 60 * 1000
const ago  = (d: number) => new Date(Date.now() - d * DAY).toISOString()

const DEMO_SIGNALS = [
  { company: 'Stripe',    type: 'FUNDING',        title: 'Stripe raises $694M at $65B valuation in secondary share sale',         url: 'https://stripe.com/newsroom', summary: 'Stripe completed a $694M secondary share sale valuing the company at $65B ahead of a potential IPO.',               llm_insight: 'Secondary at $65B signals IPO preparation — engage enterprise procurement champions before new motions lock in.', detected_at: ago(1)  },
  { company: 'Stripe',    type: 'KEY_HIRE',        title: 'Stripe appoints new Chief Revenue Officer from Salesforce',             url: 'https://stripe.com/newsroom', summary: 'Stripe hired a former Salesforce SVP as its new CRO to lead global enterprise sales expansion.',                     llm_insight: 'Salesforce-pedigreed CRO signals enterprise upmarket push — 90-day window before new process locks in.',         detected_at: ago(3)  },
  { company: 'Stripe',    type: 'PRODUCT_LAUNCH',  title: 'Stripe launches Stablecoin Financial Accounts in 101 countries',        url: 'https://stripe.com/blog',     summary: 'Stripe now lets businesses hold and send stablecoin payments in 101 countries.',                                       llm_insight: 'Global stablecoin launch opens fintech GTM channel for treasury and compliance tooling.',                        detected_at: ago(5)  },
  { company: 'Vercel',    type: 'PRODUCT_LAUNCH',  title: 'Vercel ships v0 2.0 with full-stack generation and one-click deploy',   url: 'https://vercel.com/blog',     summary: 'v0 now generates complete Next.js apps from natural language and deploys them in one click.',                           llm_insight: 'AI-native full-stack generation accelerates Vercel ecosystem adoption — ideal positioning window.',              detected_at: ago(2)  },
  { company: 'Vercel',    type: 'FUNDING',         title: 'Vercel raises $250M Series E at $3.25B valuation',                      url: 'https://vercel.com/blog',     summary: 'Vercel raised $250M Series E to accelerate enterprise sales and global infrastructure expansion.',                    llm_insight: 'Fresh $250M at $3.25B signals 18-month enterprise expansion window — high-value logo opportunity.',             detected_at: ago(8)  },
  { company: 'Vercel',    type: 'KEY_HIRE',        title: 'Vercel hires Figma design lead as VP of Product',                       url: 'https://vercel.com/blog',     summary: 'Vercel appointed a Figma product leader as VP of Product to lead the developer experience roadmap.',                   llm_insight: 'Product hire from design-forward org signals Vercel investing in DX differentiation.',                           detected_at: ago(11) },
  { company: 'Anthropic', type: 'FUNDING',         title: 'Anthropic closes $2.75B Series E funding led by Google',                url: 'https://anthropic.com/news',  summary: 'Anthropic raised $2.75B Series E with Google as lead investor, bringing total raised to over $7B.',                    llm_insight: 'Google-backed at $7B total — enterprises evaluating AI infrastructure should prioritize Anthropic now.',         detected_at: ago(4)  },
  { company: 'Anthropic', type: 'PRODUCT_LAUNCH',  title: 'Anthropic releases Claude 4 Opus with 1M token context',                url: 'https://anthropic.com/news',  summary: 'Claude 4 Opus features extended thinking, computer use, and a one-million token context window.',                      llm_insight: 'Computer-use capability competes with enterprise workflow automation tools — reassess positioning urgently.',      detected_at: ago(6)  },
  { company: 'Linear',    type: 'PRODUCT_LAUNCH',  title: 'Linear 2.0 ships with AI project scoping and redesigned roadmaps',      url: 'https://linear.app/blog',     summary: 'Linear 2.0 brings AI-assisted project planning and automatic milestone generation.',                                    llm_insight: 'AI-native PM tool moving upstream to enterprise — window to offer complementary process tooling.',               detected_at: ago(3)  },
  { company: 'Linear',    type: 'KEY_HIRE',        title: 'Linear appoints Stripe operations leader as COO',                       url: 'https://linear.app/blog',     summary: 'Linear hired a former Stripe operations executive as COO to scale operations for enterprise growth.',                   llm_insight: 'Stripe-pedigreed COO signals structured enterprise scaling — build relationships before new process sets.',       detected_at: ago(10) },
  { company: 'Rippling',  type: 'KEY_HIRE',        title: 'Rippling hires Salesforce SVP as Chief Revenue Officer',                url: 'https://rippling.com/blog',   summary: 'Rippling appointed a former Salesforce SVP of Sales as CRO to lead enterprise sales build-out.',                       llm_insight: 'Enterprise CRO hire means Rippling is scaling upmarket — existing HR vendors at risk of displacement.',          detected_at: ago(2)  },
  { company: 'Rippling',  type: 'FUNDING',         title: 'Rippling closes $200M Series F at $13.5B valuation',                    url: 'https://rippling.com/blog',   summary: 'Rippling raised $200M Series F to accelerate global expansion of its unified HR, IT, and finance platform.',           llm_insight: 'At $13.5B with fresh capital, Rippling is accelerating M&A — partner ecosystem timing is ideal.',               detected_at: ago(9)  },
  { company: 'Brex',      type: 'LAYOFF',          title: 'Brex lays off 282 employees as it exits the SMB market',                url: 'https://brex.com/blog',       summary: 'Brex cut 282 employees and pivoted exclusively to enterprise customers.',                                               llm_insight: 'Brex SMB exit creates immediate budget availability — SMB finance teams evaluating alternatives.',               detected_at: ago(5)  },
  { company: 'Brex',      type: 'KEY_HIRE',        title: 'Brex appoints Goldman Sachs managing director as CFO',                  url: 'https://brex.com/blog',       summary: 'Brex hired a former Goldman Sachs MD as CFO to lead toward profitability and a potential IPO.',                        llm_insight: 'Goldman CFO signals IPO preparation — procurement cycles will tighten; engage finance stakeholders now.',         detected_at: ago(12) },
  { company: 'Notion',    type: 'PRODUCT_LAUNCH',  title: 'Notion AI launches meeting notes and document Q&A',                     url: 'https://notion.so/blog',      summary: 'Notion expanded AI to meeting note generation and document-aware Q&A.',                                                 llm_insight: 'Notion AI attacks meeting intelligence space — Otter.ai and Fireflies users should be engaged now.',              detected_at: ago(1)  },
  { company: 'Notion',    type: 'GENERAL',         title: 'Notion announces deep Salesforce integration for CRM data sync',         url: 'https://notion.so/blog',      summary: 'Notion and Salesforce partner for bidirectional CRM data sync into Notion databases.',                                   llm_insight: 'Salesforce partnership expands Notion into CRM workflow — complementary vendors have 90 days to act.',           detected_at: ago(9)  },
  { company: 'Figma',     type: 'PRODUCT_LAUNCH',  title: 'Figma Dev Mode goes GA with VS Code extension',                         url: 'https://figma.com/blog',      summary: 'Figma Dev Mode is generally available with VS Code integration and auto-generated CSS.',                                  llm_insight: 'Dev Mode GA eliminates design-dev handoff gap — developer-focused vendors should reassess positioning.',          detected_at: ago(4)  },
  { company: 'Figma',     type: 'PRODUCT_LAUNCH',  title: 'Figma launches Slides, taking on Google Slides and PowerPoint',         url: 'https://figma.com/blog',      summary: 'Figma Slides lets teams build presentations using Figma components and real-time collaboration.',                       llm_insight: 'Figma entering presentation market — design-forward teams adopting early are high-value contacts.',              detected_at: ago(7)  },
]

// ── Repo 1: main app — active, healthy, fast merges ──────────────────────────

const MOLOCULE_THIS_WEEK = {
  prs: [
    { number: 47, title: 'feat: molecular network visualization',           author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(1), created_at: ago(3),  labels: ['feat'],  body: null },
    { number: 46, title: 'fix: digest generation timeout',                  author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(2), created_at: ago(4),  labels: ['fix'],   body: null },
    { number: 45, title: 'feat: instant signal scan on company add',        author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(3), created_at: ago(5),  labels: ['feat'],  body: null },
    { number: 44, title: 'feat: company auto-enrichment from URL',          author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(3), created_at: ago(5),  labels: ['feat'],  body: null },
    { number: 43, title: 'fix: server component event handler error',       author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(4), created_at: ago(5),  labels: ['fix'],   body: null },
    { number: 42, title: 'feat: molecule icon SVG for sidebar and login',   author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(5), created_at: ago(6),  labels: ['feat'],  body: null },
    { number: 41, title: 'chore: remove GTM references, fix em dashes',    author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(5), created_at: ago(7),  labels: ['chore'], body: null },
    { number: 40, title: 'feat: onboarding prompt with preference picker',  author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(6), created_at: ago(8),  labels: ['feat'],  body: null },
    { number: 39, title: 'chore: upgrade Next.js 14 to 16',                author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(7), created_at: ago(9),  labels: ['chore'], body: null },
    { number: 38, title: 'feat: auto-refresh signals every 30 seconds',    author: 'DylanFoler',  state: 'open',   url: 'https://github.com', merged_at: null,   created_at: ago(1),  labels: ['feat'],  body: null },
  ],
  workflow_runs: [
    { id: 1001, name: 'CI / lint + typecheck', status: 'completed', conclusion: 'success', created_at: ago(1), html_url: 'https://github.com' },
    { id: 1002, name: 'CI / lint + typecheck', status: 'completed', conclusion: 'success', created_at: ago(2), html_url: 'https://github.com' },
    { id: 1003, name: 'CI / lint + typecheck', status: 'completed', conclusion: 'failure', created_at: ago(3), html_url: 'https://github.com' },
    { id: 1004, name: 'CI / lint + typecheck', status: 'completed', conclusion: 'success', created_at: ago(4), html_url: 'https://github.com' },
    { id: 1005, name: 'Deploy to Vercel',       status: 'completed', conclusion: 'success', created_at: ago(1), html_url: 'https://github.com' },
  ],
  contributors: ['DylanFoler'],
  key_changes: ['Force-directed molecular network graph', 'Instant signal scanning on company add', 'Company auto-enrichment from URL', 'Monochrome redesign with molecule logo', 'Auto-refresh across all pages'],
}

const MOLOCULE_LAST_WEEK = {
  prs: [
    { number: 37, title: 'feat: monochrome black design system overhaul',   author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(10), created_at: ago(11), labels: ['feat'],  body: null },
    { number: 36, title: 'feat: geometric floating shape canvas animation', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(11), created_at: ago(12), labels: ['feat'],  body: null },
    { number: 35, title: 'fix: stats cards use client for hover handlers',  author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(12), created_at: ago(13), labels: ['fix'],   body: null },
    { number: 34, title: 'feat: report card PDF export with all sections',  author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(12), created_at: ago(13), labels: ['feat'],  body: null },
    { number: 33, title: 'feat: contributor table and PR size distribution', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(13), created_at: ago(14), labels: ['feat'],  body: null },
    { number: 32, title: 'chore: update README and CLAUDE.md docs',        author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(14), created_at: ago(14), labels: ['chore'], body: null },
  ],
  workflow_runs: [
    { id: 1010, name: 'CI / lint + typecheck', status: 'completed', conclusion: 'success', created_at: ago(10), html_url: 'https://github.com' },
    { id: 1011, name: 'CI / lint + typecheck', status: 'completed', conclusion: 'success', created_at: ago(11), html_url: 'https://github.com' },
    { id: 1012, name: 'CI / lint + typecheck', status: 'completed', conclusion: 'success', created_at: ago(12), html_url: 'https://github.com' },
    { id: 1013, name: 'Deploy to Vercel',       status: 'completed', conclusion: 'success', created_at: ago(10), html_url: 'https://github.com' },
  ],
  contributors: ['DylanFoler'],
  key_changes: ['Monochrome black design overhaul', 'Geometric canvas background animation', 'PR size distribution bar in digest', 'Contributor table with merge rates', 'PDF export for all digest sections'],
}

// ── Repo 2: API service — slower pace, team, some CI debt ────────────────────

const API_THIS_WEEK = {
  prs: [
    { number: 88, title: 'feat: add rate limiting to signal scan endpoint',   author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(2),  created_at: ago(5),  labels: ['feat'],  body: null },
    { number: 87, title: 'fix: supabase RLS policy for shared digest reads',  author: 'sarah-dev',   state: 'merged', url: 'https://github.com', merged_at: ago(3),  created_at: ago(5),  labels: ['fix'],   body: null },
    { number: 86, title: 'feat: cron digest endpoint for all users',          author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(4),  created_at: ago(6),  labels: ['feat'],  body: null },
    { number: 85, title: 'chore: bump anthropic SDK to 0.32',                author: 'sarah-dev',   state: 'merged', url: 'https://github.com', merged_at: ago(5),  created_at: ago(6),  labels: ['chore'], body: null },
    { number: 84, title: 'fix: Google News RSS timeout causing scan failure', author: 'DylanFoler',  state: 'open',   url: 'https://github.com', merged_at: null,    created_at: ago(8),  labels: ['fix'],   body: null },
    { number: 83, title: 'docs: update API reference for scan endpoints',     author: 'sarah-dev',   state: 'open',   url: 'https://github.com', merged_at: null,    created_at: ago(9),  labels: ['docs'],  body: null },
  ],
  workflow_runs: [
    { id: 2001, name: 'CI / tests',        status: 'completed', conclusion: 'failure', created_at: ago(2), html_url: 'https://github.com' },
    { id: 2002, name: 'CI / tests',        status: 'completed', conclusion: 'success', created_at: ago(3), html_url: 'https://github.com' },
    { id: 2003, name: 'CI / tests',        status: 'completed', conclusion: 'failure', created_at: ago(5), html_url: 'https://github.com' },
    { id: 2004, name: 'Deploy to Railway', status: 'completed', conclusion: 'success', created_at: ago(3), html_url: 'https://github.com' },
  ],
  contributors: ['DylanFoler', 'sarah-dev'],
  key_changes: ['Rate limiting on scan endpoints', 'Cron digest for all users', 'Supabase RLS policy fixed for shared reads', 'Anthropic SDK updated to 0.32'],
}

const API_LAST_WEEK = {
  prs: [
    { number: 82, title: 'feat: HN Algolia integration for signal scanning', author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(11), created_at: ago(12), labels: ['feat'],  body: null },
    { number: 81, title: 'feat: per-company scan endpoint auth gated',       author: 'sarah-dev',   state: 'merged', url: 'https://github.com', merged_at: ago(12), created_at: ago(13), labels: ['feat'],  body: null },
    { number: 80, title: 'fix: classification false positive on scam news',  author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(12), created_at: ago(13), labels: ['fix'],   body: null },
    { number: 79, title: 'refactor: extract scanner to shared lib module',   author: 'sarah-dev',   state: 'merged', url: 'https://github.com', merged_at: ago(13), created_at: ago(14), labels: ['chore'], body: null },
    { number: 78, title: 'feat: quality filter requires company name match', author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(13), created_at: ago(14), labels: ['feat'],  body: null },
    { number: 77, title: 'test: add integration tests for scanner module',   author: 'sarah-dev',   state: 'merged', url: 'https://github.com', merged_at: ago(14), created_at: ago(14), labels: ['test'],  body: null },
    { number: 76, title: 'fix: RSS parser fails on CDATA wrapped content',   author: 'DylanFoler',  state: 'merged', url: 'https://github.com', merged_at: ago(14), created_at: ago(14), labels: ['fix'],   body: null },
  ],
  workflow_runs: [
    { id: 2010, name: 'CI / tests',        status: 'completed', conclusion: 'success', created_at: ago(11), html_url: 'https://github.com' },
    { id: 2011, name: 'CI / tests',        status: 'completed', conclusion: 'success', created_at: ago(12), html_url: 'https://github.com' },
    { id: 2012, name: 'CI / tests',        status: 'completed', conclusion: 'success', created_at: ago(13), html_url: 'https://github.com' },
    { id: 2013, name: 'Deploy to Railway', status: 'completed', conclusion: 'success', created_at: ago(11), html_url: 'https://github.com' },
  ],
  contributors: ['DylanFoler', 'sarah-dev'],
  key_changes: ['HN Algolia integration for signal scanning', 'Per-company auth-gated scan endpoint', 'Scanner extracted to shared library', 'FUNDING classifier no longer matches scam articles'],
}

// ── Repo 3: landing page — fast, solo, tiny PRs ──────────────────────────────

const LANDING_THIS_WEEK = {
  prs: [
    { number: 24, title: 'feat: add demo page with interactive company graph', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(0.5), created_at: ago(1),  labels: ['feat'],  body: null },
    { number: 23, title: 'fix: mobile nav overflow on small screens',          author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(1),   created_at: ago(1.5), labels: ['fix'],   body: null },
    { number: 22, title: 'feat: pricing page with three tiers',                author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(2),   created_at: ago(2.5), labels: ['feat'],  body: null },
    { number: 21, title: 'chore: update OG image and meta tags',               author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(3),   created_at: ago(3.5), labels: ['chore'], body: null },
    { number: 20, title: 'fix: hero CTA button color contrast',                author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(4),   created_at: ago(4.5), labels: ['fix'],   body: null },
    { number: 19, title: 'feat: testimonials section with logos',              author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(5),   created_at: ago(5.5), labels: ['feat'],  body: null },
    { number: 18, title: 'feat: footer with links and newsletter form',        author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(5),   created_at: ago(5.5), labels: ['feat'],  body: null },
    { number: 17, title: 'chore: add Plausible analytics script',              author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(6),   created_at: ago(6.5), labels: ['chore'], body: null },
    { number: 16, title: 'feat: waitlist signup with email capture',           author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(6),   created_at: ago(6.5), labels: ['feat'],  body: null },
    { number: 15, title: 'fix: Vercel deploy environment vars',                author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(7),   created_at: ago(7.5), labels: ['fix'],   body: null },
    { number: 14, title: 'feat: feature comparison table vs competitors',      author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(7),   created_at: ago(7.5), labels: ['feat'],  body: null },
    { number: 13, title: 'chore: switch from npm to pnpm',                    author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(7),   created_at: ago(7.5), labels: ['chore'], body: null },
  ],
  workflow_runs: [
    { id: 3001, name: 'Deploy to Vercel', status: 'completed', conclusion: 'success', created_at: ago(0.5), html_url: 'https://github.com' },
    { id: 3002, name: 'Deploy to Vercel', status: 'completed', conclusion: 'success', created_at: ago(2),   html_url: 'https://github.com' },
    { id: 3003, name: 'Deploy to Vercel', status: 'completed', conclusion: 'success', created_at: ago(5),   html_url: 'https://github.com' },
    { id: 3004, name: 'Deploy to Vercel', status: 'completed', conclusion: 'success', created_at: ago(7),   html_url: 'https://github.com' },
  ],
  contributors: ['DylanFoler'],
  key_changes: ['Demo page with interactive company graph', 'Pricing page with three tiers', 'Testimonials section with logos', 'Waitlist email capture', 'Feature comparison table'],
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const userId   = session.user.id
  const owner    = session.user.name?.toLowerCase().replace(/\s+/g, '') ?? 'demo'

  // Clear existing demo data
  const demoNames = DEMO_COMPANIES.map(c => c.name)
  await supabase.from('companies').delete().eq('user_id', userId).in('name', demoNames)
  await supabase.from('repos').delete().eq('user_id', userId).in('github_repo_id', ['999999998', '999999997', '999999996'])

  // Insert companies
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .insert(DEMO_COMPANIES.map(c => ({ user_id: userId, ...c })))
    .select()

  if (compErr || !companies?.length) {
    return NextResponse.json({ error: `Company insert failed: ${compErr?.message}` }, { status: 500 })
  }

  const nameToId = Object.fromEntries(companies.map(c => [c.name, c.id]))

  // Insert signals
  const signals = DEMO_SIGNALS.filter(s => nameToId[s.company]).map(s => ({
    company_id: nameToId[s.company], type: s.type, title: s.title, url: s.url,
    summary: s.summary, llm_insight: s.llm_insight,
    is_new: new Date(s.detected_at) > new Date(Date.now() - 2 * DAY),
    detected_at: s.detected_at,
  }))

  const { error: sigErr } = await supabase.from('signals').insert(signals)
  if (sigErr) console.warn('Signal insert warning:', sigErr.message)

  // Insert 3 repos
  const repoInserts = [
    { user_id: userId, github_repo_id: '999999998', owner, name: 'molocule',   full_name: `${owner}/molocule`   },
    { user_id: userId, github_repo_id: '999999997', owner, name: 'signal-api', full_name: `${owner}/signal-api` },
    { user_id: userId, github_repo_id: '999999996', owner, name: 'landing',    full_name: `${owner}/landing`    },
  ]

  const { data: repos } = await supabase.from('repos').insert(repoInserts).select()
  const repoByName = Object.fromEntries((repos ?? []).map(r => [r.name, r.id]))

  // Insert digests for each repo
  const digests = [
    // molocule — this week
    {
      repo_id: repoByName['molocule'], period_start: ago(7), period_end: ago(0),
      summary: 'Outstanding week: 9 PRs merged covering the molecular network graph, instant signal scanning, and full design overhaul. One lint failure on day 3 resolved within the hour. Zero stale PRs. Team velocity is at its highest point this quarter.',
      pr_count: 10, merged_count: 9, open_count: 1,
      raw_data: MOLOCULE_THIS_WEEK,
      avg_cycle_time_hours: 36, avg_review_time_hours: null,
      pr_size_distribution: { xs: 2, s: 4, m: 3, l: 1 }, stale_pr_count: 0, failed_job_names: ['lint'],
      release_notes: '## Features\n- Force-directed molecular network graph\n- Instant signal scanning on company add\n- Company auto-enrichment from URL\n- Monochrome black redesign with molecule logo\n\n## Bug Fixes\n- Digest generation timeout resolved\n- Server component event handler error fixed\n\n## Chores\n- Removed GTM references\n- Upgraded Next.js to v16',
    },
    // molocule — last week
    {
      repo_id: repoByName['molocule'], period_start: ago(14), period_end: ago(7),
      summary: '6 PRs merged last week with a full design overhaul as the centerpiece. All CI pipelines green. The geometric canvas background and PDF export shipped cleanly. Contributor is maintaining a steady 11-hour average cycle time.',
      pr_count: 6, merged_count: 6, open_count: 0,
      raw_data: MOLOCULE_LAST_WEEK,
      avg_cycle_time_hours: 11, avg_review_time_hours: null,
      pr_size_distribution: { xs: 1, s: 3, m: 2, l: 0 }, stale_pr_count: 0, failed_job_names: [],
      release_notes: '## Features\n- Monochrome black design system\n- Geometric canvas animation\n- PR size distribution in digest\n- Contributor table with merge rates\n- PDF export for all digest sections\n\n## Bug Fixes\n- Stats card hover handler error fixed',
    },
    // signal-api — this week
    {
      repo_id: repoByName['signal-api'], period_start: ago(7), period_end: ago(0),
      summary: '4 PRs merged this week but 2 CI failures on the test suite need attention. Two PRs are open and aging — the Google News timeout fix has been in review for 8 days. sarah-dev is blocked. Recommend a focused debug session on the test failures before the next deploy.',
      pr_count: 6, merged_count: 4, open_count: 2,
      raw_data: API_THIS_WEEK,
      avg_cycle_time_hours: 72, avg_review_time_hours: null,
      pr_size_distribution: { xs: 1, s: 2, m: 1, l: 0 }, stale_pr_count: 2, failed_job_names: ['unit-tests', 'integration-tests'],
      release_notes: '## Features\n- Rate limiting on scan endpoints\n- Cron digest for all users\n\n## Bug Fixes\n- Supabase RLS policy fixed for shared reads\n\n## Chores\n- Anthropic SDK bumped to 0.32',
    },
    // signal-api — last week
    {
      repo_id: repoByName['signal-api'], period_start: ago(14), period_end: ago(7),
      summary: 'Productive week with 7 PRs merged, all CI passing. The HN Algolia integration and per-company scan endpoint shipped cleanly. sarah-dev contributed 3 of the 7 merges. The scanner refactor sets a strong foundation for the rate-limiting work next sprint.',
      pr_count: 7, merged_count: 7, open_count: 0,
      raw_data: API_LAST_WEEK,
      avg_cycle_time_hours: 24, avg_review_time_hours: null,
      pr_size_distribution: { xs: 3, s: 3, m: 1, l: 0 }, stale_pr_count: 0, failed_job_names: [],
      release_notes: '## Features\n- HN Algolia integration for signal scanning\n- Per-company auth-gated scan endpoint\n- Quality filter requires company name in title\n\n## Bug Fixes\n- FUNDING classifier no longer matches scam articles\n- RSS parser fixed for CDATA-wrapped content\n\n## Chores\n- Scanner extracted to shared lib module\n- Integration tests added',
    },
    // landing — this week (fast, solo, tiny PRs)
    {
      repo_id: repoByName['landing'], period_start: ago(7), period_end: ago(0),
      summary: '12 PRs merged this week as the landing page came together. Average cycle time of 6 hours reflects fast solo iterations. All deploys passed. Demo page, pricing, waitlist capture, and testimonials all shipped. Ready for public launch.',
      pr_count: 12, merged_count: 12, open_count: 0,
      raw_data: LANDING_THIS_WEEK,
      avg_cycle_time_hours: 6, avg_review_time_hours: null,
      pr_size_distribution: { xs: 5, s: 5, m: 2, l: 0 }, stale_pr_count: 0, failed_job_names: [],
      release_notes: '## Features\n- Demo page with interactive company graph\n- Pricing page with three tiers\n- Testimonials section with logos\n- Waitlist email capture form\n- Feature comparison table\n\n## Chores\n- Switched from npm to pnpm\n- Added Plausible analytics',
    },
  ].filter(d => d.repo_id) // skip any repo that failed to insert

  const { error: digestErr } = await supabase.from('digests').insert(digests)
  if (digestErr) console.warn('Digest insert warning:', digestErr.message)

  // Dismiss onboarding
  await supabase.from('users')
    .update({ preferences: { company_types: ['SaaS', 'FinTech', 'DevTools', 'AI'], signal_focus: ['All'] } })
    .eq('id', userId)

  return NextResponse.json({
    seeded: true,
    companies: companies.length,
    signals: signals.length,
    repos: repos?.length ?? 0,
    digests: digests.length,
  })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const demoNames = DEMO_COMPANIES.map(c => c.name)
  await supabase.from('repos').delete().eq('user_id', session.user.id).in('github_repo_id', ['999999998', '999999997', '999999996'])
  await supabase.from('companies').delete().eq('user_id', session.user.id).in('name', demoNames)
  return NextResponse.json({ cleared: true })
}
