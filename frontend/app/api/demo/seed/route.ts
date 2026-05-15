import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'

// All fields explicitly known — no description column in schema yet
const DEMO_COMPANIES = [
  {
    name: 'Stripe',
    website: 'https://stripe.com',
    github_org: 'stripe',
    linkedin_url: 'https://www.linkedin.com/company/stripe',
    blog_rss_url: 'https://stripe.com/blog/feed/rss',
  },
  {
    name: 'Vercel',
    website: 'https://vercel.com',
    github_org: 'vercel',
    linkedin_url: 'https://www.linkedin.com/company/vercel',
    blog_rss_url: 'https://vercel.com/atom',
  },
  {
    name: 'Anthropic',
    website: 'https://anthropic.com',
    github_org: 'anthropics',
    linkedin_url: 'https://www.linkedin.com/company/anthropicresearch',
    blog_rss_url: 'https://www.anthropic.com/rss.xml',
  },
  {
    name: 'Linear',
    website: 'https://linear.app',
    github_org: 'linear',
    linkedin_url: 'https://www.linkedin.com/company/linear-app',
    blog_rss_url: 'https://linear.app/blog/rss.xml',
  },
  {
    name: 'Rippling',
    website: 'https://rippling.com',
    github_org: 'rippling',
    linkedin_url: 'https://www.linkedin.com/company/rippling',
    blog_rss_url: 'https://www.rippling.com/blog/rss',
  },
  {
    name: 'Brex',
    website: 'https://brex.com',
    github_org: 'brexhq',
    linkedin_url: 'https://www.linkedin.com/company/brex-hq',
    blog_rss_url: 'https://www.brex.com/blog/rss',
  },
  {
    name: 'Notion',
    website: 'https://notion.so',
    github_org: 'makenotion',
    linkedin_url: 'https://www.linkedin.com/company/notionhq',
    blog_rss_url: 'https://www.notion.so/blog/rss',
  },
  {
    name: 'Figma',
    website: 'https://figma.com',
    github_org: 'figma',
    linkedin_url: 'https://www.linkedin.com/company/figma',
    blog_rss_url: 'https://www.figma.com/blog/rss.xml',
  },
]

const DAY = 24 * 60 * 60 * 1000
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString()

const DEMO_SIGNALS = [
  { company: 'Stripe',    type: 'FUNDING',        title: 'Stripe raises $694M at $65B valuation in secondary share sale', url: 'https://stripe.com/newsroom', summary: 'Stripe completed a $694M secondary share sale valuing the company at $65B, letting early employees and investors liquidate holdings ahead of a potential IPO.', llm_insight: 'Secondary at $65B signals IPO preparation — engage enterprise procurement champions before new sales motions lock in.', detected_at: ago(1) },
  { company: 'Stripe',    type: 'KEY_HIRE',        title: 'Stripe appoints new Chief Revenue Officer from Salesforce', url: 'https://stripe.com/newsroom', summary: 'Stripe has hired a former Salesforce SVP as its new CRO to lead a global enterprise sales expansion.', llm_insight: 'Salesforce-pedigreed CRO signals Stripe moving enterprise upmarket — 90-day window before new sales process locks in.', detected_at: ago(3) },
  { company: 'Stripe',    type: 'PRODUCT_LAUNCH',  title: 'Stripe launches Stablecoin Financial Accounts in 101 countries', url: 'https://stripe.com/blog', summary: 'Stripe now lets businesses hold, send and receive stablecoin payments in 101 countries.', llm_insight: 'Global stablecoin infrastructure opens fintech GTM channel for treasury and compliance tooling.', detected_at: ago(5) },
  { company: 'Vercel',    type: 'PRODUCT_LAUNCH',  title: 'Vercel ships v0 2.0 with full-stack generation and one-click deployment', url: 'https://vercel.com/blog', summary: 'v0 now generates complete Next.js applications from natural language and deploys them to Vercel in one click.', llm_insight: 'AI-native full-stack generation accelerates Vercel ecosystem adoption — ideal timing for developer tool positioning.', detected_at: ago(2) },
  { company: 'Vercel',    type: 'FUNDING',         title: 'Vercel raises $250M Series E at $3.25B valuation led by Accel', url: 'https://vercel.com/blog', summary: 'Vercel has raised $250M Series E to accelerate enterprise sales and global infrastructure expansion.', llm_insight: 'Fresh $250M at $3.25B signals 18-month enterprise expansion window — high-value logo opportunity.', detected_at: ago(8) },
  { company: 'Vercel',    type: 'KEY_HIRE',        title: 'Vercel hires Figma design lead as VP of Product', url: 'https://vercel.com/blog', summary: 'Vercel appointed a senior Figma product leader as VP of Product to lead the developer experience roadmap.', llm_insight: 'Product leadership hire from design-forward company signals Vercel investing in DX differentiation.', detected_at: ago(11) },
  { company: 'Anthropic', type: 'FUNDING',         title: 'Anthropic closes $2.75B Series E funding led by Google', url: 'https://anthropic.com/news', summary: 'Anthropic has raised $2.75B in Series E funding with Google as lead investor, bringing total raised to over $7B.', llm_insight: 'Google-backed at $7B total — enterprises evaluating AI infrastructure should prioritize Anthropic conversations now.', detected_at: ago(4) },
  { company: 'Anthropic', type: 'PRODUCT_LAUNCH',  title: 'Anthropic releases Claude 4 Opus with 1M token context and computer use', url: 'https://anthropic.com/news', summary: 'Claude 4 Opus features extended thinking, computer use automation, and a one-million token context window.', llm_insight: 'Computer-use capability competes directly with enterprise workflow automation tools — reassess positioning urgently.', detected_at: ago(6) },
  { company: 'Linear',    type: 'PRODUCT_LAUNCH',  title: 'Linear 2.0 ships with AI project scoping and redesigned roadmaps', url: 'https://linear.app/blog', summary: 'Linear 2.0 brings AI-assisted project planning, automatic milestone generation, and a rebuilt roadmap view.', llm_insight: 'AI-native PM tool moving upstream to enterprise — window to offer complementary process tooling.', detected_at: ago(3) },
  { company: 'Linear',    type: 'KEY_HIRE',        title: 'Linear appoints Stripe operations leader as COO', url: 'https://linear.app/blog', summary: 'Linear hired a former Stripe operations executive as COO to scale company operations for enterprise growth.', llm_insight: 'Stripe-pedigreed COO hire signals structured enterprise scaling — build relationships before new process is set.', detected_at: ago(10) },
  { company: 'Rippling',  type: 'KEY_HIRE',        title: 'Rippling hires Salesforce SVP as Chief Revenue Officer', url: 'https://rippling.com/blog', summary: 'Rippling appointed a former Salesforce SVP of Sales as CRO to lead a major enterprise sales build-out.', llm_insight: 'Enterprise CRO hire means Rippling is scaling upmarket — existing HR vendors at risk of displacement.', detected_at: ago(2) },
  { company: 'Rippling',  type: 'FUNDING',         title: 'Rippling closes $200M Series F at $13.5B valuation', url: 'https://rippling.com/blog', summary: 'Rippling raised $200M Series F to accelerate global expansion of its unified HR, IT, and finance platform.', llm_insight: 'At $13.5B with fresh capital, Rippling is accelerating M&A — partner ecosystem timing is ideal.', detected_at: ago(9) },
  { company: 'Brex',      type: 'LAYOFF',          title: 'Brex lays off 282 employees as it exits the SMB market entirely', url: 'https://brex.com/blog', summary: 'Brex cut 282 employees and pivoted exclusively to enterprise customers, exiting the SMB segment.', llm_insight: 'Brex SMB exit creates immediate budget availability signal — SMB finance teams may be actively evaluating alternatives.', detected_at: ago(5) },
  { company: 'Brex',      type: 'KEY_HIRE',        title: 'Brex appoints Goldman Sachs managing director as CFO', url: 'https://brex.com/blog', summary: 'Brex hired a former Goldman Sachs MD as CFO to lead the company toward profitability and a potential IPO.', llm_insight: 'Goldman CFO signals Brex IPO preparation — procurement cycles will tighten; engage finance stakeholders now.', detected_at: ago(12) },
  { company: 'Notion',    type: 'PRODUCT_LAUNCH',  title: 'Notion AI launches meeting notes, document Q&A, and database auto-fill', url: 'https://notion.so/blog', summary: 'Notion expanded its AI to meeting note generation, document-aware Q&A, and automatic database population.', llm_insight: 'Notion AI directly attacking meeting intelligence — Otter.ai and Fireflies users should be engaged immediately.', detected_at: ago(1) },
  { company: 'Notion',    type: 'GENERAL',         title: 'Notion announces deep Salesforce integration for CRM data sync', url: 'https://notion.so/blog', summary: 'Notion and Salesforce partnered to allow bidirectional CRM data sync into Notion databases.', llm_insight: 'Salesforce partnership expands Notion into CRM workflow — complementary tool vendors have 90 days to establish footholds.', detected_at: ago(9) },
  { company: 'Figma',     type: 'PRODUCT_LAUNCH',  title: 'Figma Dev Mode goes GA with VS Code extension and auto-generated snippets', url: 'https://figma.com/blog', summary: 'Figma Dev Mode is generally available with VS Code integration, auto-generated CSS, and design token export.', llm_insight: 'Dev Mode GA eliminates design-dev handoff gap — developer-focused tool vendors should reassess their positioning.', detected_at: ago(4) },
  { company: 'Figma',     type: 'PRODUCT_LAUNCH',  title: 'Figma launches Slides, taking on Google Slides and PowerPoint', url: 'https://figma.com/blog', summary: 'Figma Slides lets teams build presentations using Figma components, design tokens, and real-time collaboration.', llm_insight: 'Figma entering presentation market — design-forward teams adopting early are high-value contacts.', detected_at: ago(7) },
]

const DEMO_DIGEST_RAW = {
  prs: [
    { number: 47, title: 'feat: molecular network visualization with force-directed physics', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(1), created_at: ago(3), labels: ['feat'], body: null },
    { number: 46, title: 'fix: digest generation timeout - reduce API calls from 45 to 3', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(2), created_at: ago(4), labels: ['fix'], body: null },
    { number: 45, title: 'feat: instant signal scan on company add via Google News + HN', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(3), created_at: ago(5), labels: ['feat'], body: null },
    { number: 44, title: 'feat: company auto-enrichment - single input fetches all metadata', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(4), created_at: ago(6), labels: ['feat'], body: null },
    { number: 43, title: 'fix: server component cannot pass onSuccess function to client', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(5), created_at: ago(6), labels: ['fix'], body: null },
    { number: 42, title: 'feat: molecule icon SVG replaces Zap in sidebar and login', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(5), created_at: ago(7), labels: ['feat'], body: null },
    { number: 41, title: 'chore: remove GTM references and fix em dashes across all copy', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(6), created_at: ago(7), labels: ['chore'], body: null },
    { number: 40, title: 'feat: onboarding prompt with company type and signal focus', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(6), created_at: ago(8), labels: ['feat'], body: null },
    { number: 39, title: 'chore: upgrade Next.js 14 to 16, fix serverExternalPackages', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: ago(7), created_at: ago(9), labels: ['chore'], body: null },
    { number: 38, title: 'feat: auto-refresh dashboard and signals every 30 seconds', author: 'DylanFoler', state: 'open', url: 'https://github.com', merged_at: null, created_at: ago(1), labels: ['feat'], body: null },
  ],
  workflow_runs: [
    { id: 1001, name: 'CI', status: 'completed', conclusion: 'success', created_at: ago(1), html_url: 'https://github.com' },
    { id: 1002, name: 'CI', status: 'completed', conclusion: 'success', created_at: ago(2), html_url: 'https://github.com' },
    { id: 1003, name: 'CI', status: 'completed', conclusion: 'failure', created_at: ago(3), html_url: 'https://github.com' },
    { id: 1004, name: 'CI', status: 'completed', conclusion: 'success', created_at: ago(4), html_url: 'https://github.com' },
    { id: 1005, name: 'Deploy', status: 'completed', conclusion: 'success', created_at: ago(1), html_url: 'https://github.com' },
  ],
  contributors: ['DylanFoler'],
  key_changes: [
    'Force-directed molecular network graph for company connections',
    'Instant signal scanning on company add via Google News and HN',
    'Company auto-enrichment from single URL input',
    'Auto-refresh every 30s across all dashboard pages',
    'Monochrome black redesign with molecule chain logo',
  ],
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const userId = session.user.id

  // Clear any existing demo companies first so we can re-seed cleanly
  const demoNames = DEMO_COMPANIES.map(c => c.name)
  await supabase.from('companies').delete().eq('user_id', userId).in('name', demoNames)

  // Insert companies — only columns that exist in the schema
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .insert(DEMO_COMPANIES.map(c => ({
      user_id:      userId,
      name:         c.name,
      website:      c.website,
      github_org:   c.github_org,
      linkedin_url: c.linkedin_url,
      blog_rss_url: c.blog_rss_url,
    })))
    .select()

  if (compErr || !companies?.length) {
    console.error('Demo company insert failed:', compErr?.message)
    return NextResponse.json({ error: `Company insert failed: ${compErr?.message}` }, { status: 500 })
  }

  const nameToId = Object.fromEntries(companies.map(c => [c.name, c.id]))

  // Insert signals
  const signals = DEMO_SIGNALS
    .filter(s => nameToId[s.company])
    .map(s => ({
      company_id:  nameToId[s.company],
      type:        s.type,
      title:       s.title,
      url:         s.url,
      summary:     s.summary,
      llm_insight: s.llm_insight,
      is_new:      new Date(s.detected_at) > new Date(Date.now() - 2 * DAY),
      detected_at: s.detected_at,
    }))

  const { error: sigErr } = await supabase.from('signals').insert(signals)
  if (sigErr) console.warn('Signal insert warning:', sigErr.message)

  // Insert demo repo + digest
  const { data: repo } = await supabase.from('repos').insert({
    user_id:       userId,
    github_repo_id: '999999998',
    owner:         session.user.name?.toLowerCase().replace(/\s+/g, '') ?? 'demo',
    name:          'molocule',
    full_name:     `${session.user.name?.toLowerCase().replace(/\s+/g, '') ?? 'demo'}/molocule`,
  }).select().single()

  if (repo) {
    await supabase.from('digests').insert({
      repo_id:        repo.id,
      period_start:   ago(7),
      period_end:     new Date().toISOString(),
      summary:        'Excellent shipping week with 9 merged PRs. The molecular network graph, instant signal scanning, and company auto-enrichment all landed cleanly. One CI failure on day 3 was resolved within an hour. Zero stale PRs, contributors maintaining fast merge cadence. The codebase is healthy and ready for the next feature cycle.',
      pr_count:       DEMO_DIGEST_RAW.prs.length,
      merged_count:   9,
      open_count:     1,
      raw_data:       DEMO_DIGEST_RAW,
      avg_cycle_time_hours:  36,
      avg_review_time_hours: null,
      pr_size_distribution:  { xs: 2, s: 4, m: 3, l: 1 },
      stale_pr_count:        0,
      failed_job_names:      ['lint'],
      release_notes:         '## Features\n- Force-directed molecular network graph\n- Instant signal scanning on company add\n- Company auto-enrichment from single URL\n- Auto-refresh every 30s across all pages\n\n## Bug Fixes\n- Digest generation timeout resolved\n- Server component event handler error fixed\n\n## Chores\n- Removed GTM references throughout\n- Upgraded Next.js to v16',
    })
  }

  // Dismiss onboarding prompt
  await supabase.from('users')
    .update({ preferences: { company_types: ['SaaS', 'FinTech', 'DevTools', 'AI'], signal_focus: ['All'] } })
    .eq('id', userId)

  return NextResponse.json({ seeded: true, companies: companies.length, signals: signals.length, digest: !!repo })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const demoNames = DEMO_COMPANIES.map(c => c.name)
  const { error } = await supabase.from('companies').delete().eq('user_id', session.user.id).in('name', demoNames)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cleared: true })
}
