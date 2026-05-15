import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'

const DEMO_COMPANIES = [
  { name: 'Stripe', website: 'https://stripe.com', github_org: 'stripe', linkedin_url: 'https://www.linkedin.com/company/stripe', blog_rss_url: null, description: 'Stripe builds financial infrastructure for the internet. Businesses of every size use Stripe to accept payments, send payouts, and manage their finances online.' },
  { name: 'Vercel', website: 'https://vercel.com', github_org: 'vercel', linkedin_url: 'https://www.linkedin.com/company/vercel', blog_rss_url: 'https://vercel.com/atom', description: 'Vercel provides the developer tools and cloud infrastructure to build, scale, and secure a faster, more personalized web. The platform powers the frontend of the modern web.' },
  { name: 'Anthropic', website: 'https://anthropic.com', github_org: 'anthropics', linkedin_url: 'https://www.linkedin.com/company/anthropicresearch', blog_rss_url: null, description: 'Anthropic is an AI safety company working to build reliable, interpretable, and steerable AI systems. They create large language models including the Claude family.' },
  { name: 'Linear', website: 'https://linear.app', github_org: 'linear', linkedin_url: 'https://www.linkedin.com/company/linear-app', blog_rss_url: 'https://linear.app/blog/rss.xml', description: 'Linear is a modern software project management tool built for high-performance teams. It streamlines issues, projects, and roadmaps with keyboard-first workflows.' },
  { name: 'Rippling', website: 'https://rippling.com', github_org: 'rippling', linkedin_url: 'https://www.linkedin.com/company/rippling', blog_rss_url: null, description: 'Rippling is an all-in-one platform that makes it easy to manage your employees across HR, IT, and finance. It connects every workforce system to a single source of truth.' },
  { name: 'Brex', website: 'https://brex.com', github_org: 'brexhq', linkedin_url: 'https://www.linkedin.com/company/brex-hq', blog_rss_url: null, description: 'Brex is a financial technology company offering corporate cards and spend management software. It targets startups and high-growth companies with AI-powered financial controls.' },
  { name: 'Notion', website: 'https://notion.so', github_org: 'makenotion', linkedin_url: 'https://www.linkedin.com/company/notionhq', blog_rss_url: null, description: 'Notion is an all-in-one workspace that combines notes, docs, databases, and project management. Teams use it to organize knowledge, manage projects, and collaborate asynchronously.' },
  { name: 'Figma', website: 'https://figma.com', github_org: 'figma', linkedin_url: 'https://www.linkedin.com/company/figma', blog_rss_url: 'https://www.figma.com/blog/rss.xml', description: 'Figma is a collaborative interface design tool used by product teams worldwide. It enables real-time collaboration on design files from any browser, including dev handoff and prototyping.' },
]

const DAY = 24 * 60 * 60 * 1000

function daysAgo(d: number) {
  return new Date(Date.now() - d * DAY).toISOString()
}

const DEMO_SIGNALS = [
  // Stripe
  { company: 'Stripe', type: 'FUNDING', title: 'Stripe raises $694M at $65B valuation in secondary share sale', url: 'https://stripe.com/newsroom', summary: 'Stripe completed a $694M secondary share sale valuing the company at $65B, letting early employees and investors liquidate holdings as an IPO alternative.', llm_insight: 'Secondary at $65B signals IPO preparation and gives sales teams a timely hook for enterprise conversations.', detected_at: daysAgo(1) },
  { company: 'Stripe', type: 'KEY_HIRE', title: 'Stripe appoints Claire Hughes Johnson as Independent Board Director', url: 'https://stripe.com/newsroom', summary: 'Former Stripe COO Claire Hughes Johnson rejoins the board as the company prepares for a potential public offering.', llm_insight: 'Board strengthening ahead of IPO means tightened procurement cycles — engage procurement champions now.', detected_at: daysAgo(3) },
  { company: 'Stripe', type: 'PRODUCT_LAUNCH', title: 'Stripe launches Stablecoin Financial Accounts in 101 countries', url: 'https://stripe.com/blog', summary: 'Stripe now lets businesses hold, send and receive stablecoin payments in 101 countries, expanding beyond traditional payment rails.', llm_insight: 'Global stablecoin infrastructure launch opens a fintech GTM channel for complimentary treasury and compliance tools.', detected_at: daysAgo(5) },
  // Vercel
  { company: 'Vercel', type: 'PRODUCT_LAUNCH', title: 'Vercel ships v0 2.0 with full-stack generation and deployment', url: 'https://vercel.com/blog', summary: 'v0 now generates full-stack Next.js applications from natural language prompts and deploys them directly to Vercel infrastructure.', llm_insight: 'AI-native full-stack generation accelerates Vercel ecosystem adoption — ideal timing for developer tool positioning.', detected_at: daysAgo(2) },
  { company: 'Vercel', type: 'KEY_HIRE', title: 'Vercel hires Sarah Guo as VP of Go-to-Market', url: 'https://vercel.com/blog', summary: 'Vercel has hired Sarah Guo as VP of Go-to-Market to lead the company\'s enterprise sales expansion.', llm_insight: 'New GTM leader signals enterprise sales ramp-up — engage early before new sales motions lock in existing vendors.', detected_at: daysAgo(7) },
  { company: 'Vercel', type: 'FUNDING', title: 'Vercel raises $250M Series E at $3.25B valuation', url: 'https://vercel.com/blog', summary: 'Vercel has raised $250M in a Series E funding round led by Accel, bringing their total valuation to $3.25B.', llm_insight: 'Fresh $250M gives Vercel 18-month runway for aggressive enterprise expansion — high-value logo opportunity.', detected_at: daysAgo(14) },
  // Anthropic
  { company: 'Anthropic', type: 'FUNDING', title: 'Anthropic raises $2.75B in Series E funding from Google and others', url: 'https://anthropic.com/news', summary: 'Anthropic has raised $2.75B in a Series E round, with Google as the lead investor, for a total raise of over $7B.', llm_insight: 'Google-backed $2.75B signals Anthropic is becoming critical AI infrastructure — enterprises evaluating AI stacks should engage now.', detected_at: daysAgo(4) },
  { company: 'Anthropic', type: 'PRODUCT_LAUNCH', title: 'Anthropic releases Claude 4 with extended thinking and computer use', url: 'https://anthropic.com/news', summary: 'Claude 4 is Anthropic\'s most capable model, featuring extended thinking chains, computer use, and a 1M token context window.', llm_insight: 'Claude 4 computer-use capability opens automation use cases that compete with existing enterprise workflow tools.', detected_at: daysAgo(6) },
  // Linear
  { company: 'Linear', type: 'PRODUCT_LAUNCH', title: 'Linear 2.0 ships with AI-powered project planning and roadmaps', url: 'https://linear.app/blog', summary: 'Linear 2.0 introduces AI-assisted project scoping, automatic milestone generation, and a redesigned roadmap view.', llm_insight: 'AI-native project management signals Linear moving upstream toward enterprise — opportunity to offer complementary process tooling.', detected_at: daysAgo(3) },
  { company: 'Linear', type: 'KEY_HIRE', title: 'Linear brings on Intercom co-founder Des Traynor as Strategic Advisor', url: 'https://linear.app/blog', summary: 'Des Traynor joins Linear as a strategic advisor to help shape its enterprise go-to-market strategy.', llm_insight: 'Intercom co-founder advisory signals deliberate enterprise motion — product-led growth transitioning to sales-led.', detected_at: daysAgo(10) },
  // Rippling
  { company: 'Rippling', type: 'KEY_HIRE', title: 'Rippling hires Salesforce veteran as Chief Revenue Officer', url: 'https://rippling.com/blog', summary: 'Rippling has appointed a former Salesforce SVP of Sales as its new Chief Revenue Officer to lead a major enterprise sales expansion.', llm_insight: 'Salesforce-pedigreed CRO hire signals Rippling entering enterprise upmarket — existing HR/IT vendors at risk of displacement.', detected_at: daysAgo(2) },
  { company: 'Rippling', type: 'FUNDING', title: 'Rippling raises $200M Series F, valuation reaches $13.5B', url: 'https://rippling.com/blog', summary: 'Rippling closed a $200M Series F round, extending its runway to aggressively expand its global HR and IT platform.', llm_insight: 'At $13.5B valuation with fresh capital, Rippling is accelerating M&A and product expansion — partner ecosystem timing is ideal.', detected_at: daysAgo(8) },
  { company: 'Rippling', type: 'PRODUCT_LAUNCH', title: 'Rippling launches AI-powered global payroll with 50-country support', url: 'https://rippling.com/blog', summary: 'Rippling Global Payroll now supports 50 countries with AI-assisted compliance and automatic currency conversion.', llm_insight: 'Global payroll expansion into 50 countries displaces incumbent providers — multinational HR buyers actively evaluating alternatives.', detected_at: daysAgo(11) },
  // Brex
  { company: 'Brex', type: 'LAYOFF', title: 'Brex lays off 282 employees, about 20% of total workforce', url: 'https://brex.com/blog', summary: 'Brex announced a reduction of 282 employees as the company shifts focus from SMB to enterprise customers exclusively.', llm_insight: 'Brex SMB exit creates urgent budget availability signal — enterprise finance teams losing Brex may be receptive to alternatives.', detected_at: daysAgo(5) },
  { company: 'Brex', type: 'KEY_HIRE', title: 'Brex appoints former Goldman Sachs executive as CFO', url: 'https://brex.com/blog', summary: 'Brex has hired a former Goldman Sachs managing director as its new CFO to lead the company\'s push toward profitability.', llm_insight: 'Goldman CFO hire signals Brex IPO preparation and enterprise credibility push — procurement cycles likely to tighten.', detected_at: daysAgo(12) },
  // Notion
  { company: 'Notion', type: 'PRODUCT_LAUNCH', title: 'Notion AI launches meeting notes, document Q&A and auto-fill database', url: 'https://notion.so/blog', summary: 'Notion has expanded its AI features to include meeting note generation, document-aware Q&A, and automatic database population from unstructured content.', llm_insight: 'Notion AI attacking meeting intelligence space directly — existing Otter.ai and Fireflies users should be engaged now.', detected_at: daysAgo(1) },
  { company: 'Notion', type: 'GENERAL', title: 'Notion announces enterprise partnership with Salesforce for CRM integration', url: 'https://notion.so/blog', summary: 'Notion and Salesforce have announced a deep integration allowing CRM data to sync bidirectionally with Notion databases.', llm_insight: 'Salesforce partnership expands Notion into CRM workflow territory — complementary tool vendors have 90 days to establish relationships.', detected_at: daysAgo(9) },
  // Figma
  { company: 'Figma', type: 'PRODUCT_LAUNCH', title: 'Figma launches Dev Mode GA with VS Code extension and code snippets', url: 'https://figma.com/blog', summary: 'Figma Dev Mode is now generally available with native VS Code extension, auto-generated code snippets, and CSS variable export.', llm_insight: 'Dev Mode GA eliminates the design-dev handoff gap — developer-focused tool vendors should reassess positioning against Figma.', detected_at: daysAgo(4) },
  { company: 'Figma', type: 'KEY_HIRE', title: 'Figma names Dylan Field CEO post-Adobe acquisition collapse', url: 'https://figma.com/blog', summary: 'Following the collapse of Adobe\'s $20B acquisition bid, Dylan Field reasserts leadership with a new strategic vision for Figma\'s independent future.', llm_insight: 'Post-acquisition independence rally signals Figma doubling down on enterprise — fresh budget cycles and new exec relationships available.', detected_at: daysAgo(15) },
  { company: 'Figma', type: 'PRODUCT_LAUNCH', title: 'Figma launches Slides, a presentation tool built on its design infrastructure', url: 'https://figma.com/blog', summary: 'Figma Slides is a new presentation product that lets teams build pitch decks and presentations using Figma components and design tokens.', llm_insight: 'Figma entering presentation market attacks Google Slides and PowerPoint — design-forward teams adopting early are high-value contacts.', detected_at: daysAgo(7) },
]

const DEMO_DIGEST_RAW = {
  prs: [
    { number: 47, title: 'feat: molecular network visualization with force-directed graph', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: daysAgo(1), created_at: daysAgo(3), labels: ['feat'], body: 'Adds interactive company network graph using canvas-based physics simulation.' },
    { number: 46, title: 'fix: digest generation timeout - reduce GitHub API calls from 45 to 3', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: daysAgo(2), created_at: daysAgo(4), labels: ['fix'], body: 'Rewrote computeDigestMetrics to use pre-fetched data only.' },
    { number: 45, title: 'feat: instant signal scan on company add via Google News + HN Algolia', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: daysAgo(3), created_at: daysAgo(5), labels: ['feat'], body: 'Scanner now hits Google News RSS and HN Algolia on company creation.' },
    { number: 44, title: 'feat: company auto-enrichment - single input fetches all metadata', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: daysAgo(4), created_at: daysAgo(6), labels: ['feat'], body: null },
    { number: 43, title: 'fix: server component cannot pass onSuccess function to client component', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: daysAgo(5), created_at: daysAgo(6), labels: ['fix'], body: null },
    { number: 42, title: 'feat: molecule icon SVG replaces Zap in sidebar and login', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: daysAgo(5), created_at: daysAgo(7), labels: ['feat'], body: null },
    { number: 41, title: 'chore: remove GTM references, fix em dashes across all copy', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: daysAgo(6), created_at: daysAgo(7), labels: ['chore'], body: null },
    { number: 40, title: 'feat: onboarding prompt with company type and signal focus selection', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: daysAgo(6), created_at: daysAgo(8), labels: ['feat'], body: null },
    { number: 39, title: 'chore: upgrade Next.js 14 to 16, fix serverExternalPackages config', author: 'DylanFoler', state: 'merged', url: 'https://github.com', merged_at: daysAgo(7), created_at: daysAgo(9), labels: ['chore'], body: null },
    { number: 38, title: 'feat: auto-refresh dashboard and signals every 30 seconds without reload', author: 'DylanFoler', state: 'open', url: 'https://github.com', merged_at: null, created_at: daysAgo(1), labels: ['feat'], body: null },
  ],
  workflow_runs: [
    { id: 1001, name: 'CI', status: 'completed', conclusion: 'success', created_at: daysAgo(1), html_url: 'https://github.com' },
    { id: 1002, name: 'CI', status: 'completed', conclusion: 'success', created_at: daysAgo(2), html_url: 'https://github.com' },
    { id: 1003, name: 'CI', status: 'completed', conclusion: 'failure', created_at: daysAgo(3), html_url: 'https://github.com' },
    { id: 1004, name: 'CI', status: 'completed', conclusion: 'success', created_at: daysAgo(4), html_url: 'https://github.com' },
    { id: 1005, name: 'Deploy to Vercel', status: 'completed', conclusion: 'success', created_at: daysAgo(1), html_url: 'https://github.com' },
  ],
  contributors: ['DylanFoler'],
  key_changes: [
    'Force-directed molecular network graph for company connections',
    'Instant signal scanning on company add via free news APIs',
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

  // Check if demo already seeded
  const { data: existing } = await supabase
    .from('companies').select('id').eq('user_id', userId).eq('name', 'Stripe').limit(1).maybeSingle()

  if (existing) {
    return NextResponse.json({ message: 'Demo data already loaded', already_seeded: true })
  }

  // Insert companies
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .insert(DEMO_COMPANIES.map(c => ({ ...c, user_id: userId })))
    .select()

  if (compErr || !companies) {
    return NextResponse.json({ error: `Failed to seed companies: ${compErr?.message}` }, { status: 500 })
  }

  // Map company names to IDs
  const nameToId = Object.fromEntries(companies.map(c => [c.name, c.id]))

  // Insert signals
  const signals = DEMO_SIGNALS.map(s => ({
    company_id: nameToId[s.company],
    type: s.type,
    title: s.title,
    url: s.url,
    summary: s.summary,
    llm_insight: s.llm_insight,
    is_new: s.detected_at > daysAgo(2),
    detected_at: s.detected_at,
  })).filter(s => s.company_id)

  const { error: sigErr } = await supabase.from('signals').insert(signals)
  if (sigErr) console.warn('Signal seed warning:', sigErr.message)

  // Insert a demo repo + digest
  const { data: repo } = await supabase.from('repos').insert({
    user_id: userId,
    github_repo_id: '999999999',
    owner: session.user.name ?? 'demo',
    name: 'molocule',
    full_name: `${session.user.name ?? 'demo'}/molocule`,
  }).select().single()

  if (repo) {
    const { error: digestErr } = await supabase.from('digests').insert({
      repo_id: repo.id,
      period_start: daysAgo(7),
      period_end: new Date().toISOString(),
      summary: 'Strong shipping week: 9 PRs merged covering the molecular network visualization, instant signal scanning via Google News and HN Algolia, and a full monochrome redesign. CI had one failure on day 3 that was immediately resolved. Codebase is healthy with no stale PRs. The auto-enrichment and auto-refresh features are production-ready.',
      pr_count: DEMO_DIGEST_RAW.prs.length,
      merged_count: DEMO_DIGEST_RAW.prs.filter(p => p.state === 'merged').length,
      open_count: 1,
      raw_data: DEMO_DIGEST_RAW,
      avg_cycle_time_hours: 36,
      avg_review_time_hours: null,
      pr_size_distribution: { xs: 2, s: 4, m: 3, l: 1 },
      stale_pr_count: 0,
      failed_job_names: ['lint'],
      release_notes: '## Features\n- Force-directed molecular network graph for company connections\n- Instant signal scanning on company add\n- Company auto-enrichment from single URL input\n- Auto-refresh every 30s across all pages\n\n## Bug Fixes\n- Digest generation timeout fixed\n- Server component event handler error resolved\n\n## Chores\n- Removed GTM references\n- Upgraded Next.js to v16',
    })
    if (digestErr) console.warn('Digest seed warning:', digestErr.message)
  }

  // Mark preferences so onboarding prompt is dismissed
  await supabase.from('users').update({
    preferences: { company_types: ['SaaS', 'FinTech', 'DevTools', 'AI'], signal_focus: ['All'] }
  }).eq('id', userId)

  return NextResponse.json({
    seeded: true,
    companies: companies.length,
    signals: signals.length,
    digest: !!repo,
  })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const demoNames = DEMO_COMPANIES.map(c => c.name)
  await supabase.from('companies').delete().eq('user_id', session.user.id).in('name', demoNames)

  return NextResponse.json({ cleared: true })
}
