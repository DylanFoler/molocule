export const dynamic = 'force-dynamic'

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
  { company: 'Stripe',    type: 'FUNDING',        title: 'Stripe raises $694M at $65B valuation in secondary share sale',         url: 'https://stripe.com/newsroom', summary: 'Stripe completed a $694M secondary share sale valuing the company at $65B ahead of a potential IPO.',               llm_insight: 'Stripe\'s $694M secondary at $65B confirms IPO preparation is underway. New enterprise sales motions will take shape as fresh capital gets deployed into go-to-market over the next two quarters.',                                                                                                       detected_at: ago(1)  },
  { company: 'Stripe',    type: 'KEY_HIRE',        title: 'Stripe appoints new Chief Revenue Officer from Salesforce',             url: 'https://stripe.com/newsroom', summary: 'Stripe hired a former Salesforce SVP as its new CRO to lead global enterprise sales expansion.',                     llm_insight: 'A Salesforce SVP entering Stripe as CRO signals the company is professionalizing its enterprise sales org beyond founder-led growth. Expect structured territory planning and enterprise packaging changes within 180 days.',                                                                           detected_at: ago(3)  },
  { company: 'Stripe',    type: 'PRODUCT_LAUNCH',  title: 'Stripe launches Stablecoin Financial Accounts in 101 countries',        url: 'https://stripe.com/blog',     summary: 'Stripe now lets businesses hold and send stablecoin payments in 101 countries.',                                       llm_insight: 'Stablecoin accounts in 101 countries repositions Stripe as infrastructure for digital asset treasury management, not just payment processing. This competes directly with B2B crypto payment platforms that have been building this layer independently.',                                                detected_at: ago(5)  },
  { company: 'Vercel',    type: 'PRODUCT_LAUNCH',  title: 'Vercel ships v0 2.0 with full-stack generation and one-click deploy',   url: 'https://vercel.com/blog',     summary: 'v0 now generates complete Next.js apps from natural language and deploys them in one click.',                           llm_insight: 'v0 2.0 compresses the time from idea to deployed full-stack app, directly threatening low-code platforms that have been targeting the same non-technical builder segment. Vercel now controls the entire development surface for a growing share of production apps.',                                    detected_at: ago(2)  },
  { company: 'Vercel',    type: 'FUNDING',         title: 'Vercel raises $250M Series E at $3.25B valuation',                      url: 'https://vercel.com/blog',     summary: 'Vercel raised $250M Series E to accelerate enterprise sales and global infrastructure expansion.',                    llm_insight: 'Vercel\'s $250M Series E is targeted at enterprise infrastructure and global sales expansion. The company is shifting from dev tool to enterprise platform, which will change how procurement conversations are structured at companies over 500 employees.',                                             detected_at: ago(8)  },
  { company: 'Vercel',    type: 'KEY_HIRE',        title: 'Vercel hires Figma design lead as VP of Product',                       url: 'https://vercel.com/blog',     summary: 'Vercel appointed a Figma product leader as VP of Product to lead the developer experience roadmap.',                   llm_insight: 'Bringing a Figma design leader into VP of Product signals Vercel is treating developer experience as a product discipline. This hire will likely reshape the roadmap around polish and usability rather than raw infrastructure capabilities.',                                                            detected_at: ago(11) },
  { company: 'Anthropic', type: 'FUNDING',         title: 'Anthropic closes $2.75B Series E funding led by Google',                url: 'https://anthropic.com/news',  summary: 'Anthropic raised $2.75B Series E with Google as lead investor, bringing total raised to over $7B.',                    llm_insight: 'Google leading Anthropic\'s Series E at $2.75B deepens the strategic dependency between both companies. Anthropic\'s enterprise API positioning now carries Google\'s cloud distribution as an implicit advantage in evaluations against OpenAI.',                                                        detected_at: ago(4)  },
  { company: 'Anthropic', type: 'PRODUCT_LAUNCH',  title: 'Anthropic releases Claude 4 Opus with 1M token context',                url: 'https://anthropic.com/news',  summary: 'Claude 4 Opus features extended thinking, computer use, and a one-million token context window.',                      llm_insight: 'Claude 4 Opus with computer-use and 1M token context competes directly with enterprise workflow automation platforms that depend on human-in-the-loop task completion. Companies building automation layers on older models should evaluate whether this capability makes their integration redundant.',    detected_at: ago(6)  },
  { company: 'Linear',    type: 'PRODUCT_LAUNCH',  title: 'Linear 2.0 ships with AI project scoping and redesigned roadmaps',      url: 'https://linear.app/blog',     summary: 'Linear 2.0 brings AI-assisted project planning and automatic milestone generation.',                                    llm_insight: 'Linear 2.0 adding AI project scoping puts it in direct competition with Jira\'s AI roadmap features and Notion\'s planning expansion. Linear\'s opinionated approach will accelerate adoption among engineering teams that find Jira\'s complexity a liability.',                                       detected_at: ago(3)  },
  { company: 'Linear',    type: 'KEY_HIRE',        title: 'Linear appoints Stripe operations leader as COO',                       url: 'https://linear.app/blog',     summary: 'Linear hired a former Stripe operations executive as COO to scale operations for enterprise growth.',                   llm_insight: 'A Stripe operations executive entering Linear as COO signals the company is transitioning from founder-operated to professionally scaled. Stripe\'s operational rigor around contracts and enterprise procurement is precisely the muscle Linear needs to compete upmarket.',                              detected_at: ago(10) },
  { company: 'Rippling',  type: 'KEY_HIRE',        title: 'Rippling hires Salesforce SVP as Chief Revenue Officer',                url: 'https://rippling.com/blog',   summary: 'Rippling appointed a former Salesforce SVP of Sales as CRO to lead enterprise sales build-out.',                       llm_insight: 'Rippling hiring a Salesforce SVP as CRO mirrors Stripe\'s enterprise playbook from two years ago. HR platforms in the mid-market segment will face a more structured competitive motion from Rippling within the next two quarters.',                                                                    detected_at: ago(2)  },
  { company: 'Rippling',  type: 'FUNDING',         title: 'Rippling closes $200M Series F at $13.5B valuation',                    url: 'https://rippling.com/blog',   summary: 'Rippling raised $200M Series F to accelerate global expansion of its unified HR, IT, and finance platform.',           llm_insight: 'Rippling\'s $200M Series F at $13.5B is structured for M&A and international expansion. The unified HR, IT, and finance platform thesis is being validated at scale, which increases pressure on point solutions in each of those three stacks independently.',                                           detected_at: ago(9)  },
  { company: 'Brex',      type: 'LAYOFF',          title: 'Brex lays off 282 employees as it exits the SMB market',                url: 'https://brex.com/blog',       summary: 'Brex cut 282 employees and pivoted exclusively to enterprise customers.',                                               llm_insight: 'Brex cutting 282 employees while exiting SMB is a permanent strategic pivot, not a cost cut. The 282 freed SMB seats will migrate to Ramp, Divvy, or Mercury over the next 90 days as customers who can\'t meet Brex\'s new enterprise minimums look for alternatives.',                                detected_at: ago(5)  },
  { company: 'Brex',      type: 'KEY_HIRE',        title: 'Brex appoints Goldman Sachs managing director as CFO',                  url: 'https://brex.com/blog',       summary: 'Brex hired a former Goldman Sachs MD as CFO to lead toward profitability and a potential IPO.',                        llm_insight: 'A Goldman Sachs MD entering Brex as CFO brings IPO-grade financial discipline to a company that has been operating at growth-stage velocity. Expect tightening on sales cycle metrics, gross margin improvement, and audited financials over the next 12 months.',                                        detected_at: ago(12) },
  { company: 'Notion',    type: 'PRODUCT_LAUNCH',  title: 'Notion AI launches meeting notes and document Q&A',                     url: 'https://notion.so/blog',      summary: 'Notion expanded AI to meeting note generation and document-aware Q&A.',                                                 llm_insight: 'Notion AI expanding into meeting notes directly attacks Otter.ai and Fireflies in a market those companies built without a bundled workspace advantage. Meeting intelligence bundled into Notion removes a standalone budget line for teams already paying for the platform.',                             detected_at: ago(1)  },
  { company: 'Notion',    type: 'GENERAL',         title: 'Notion announces deep Salesforce integration for CRM data sync',         url: 'https://notion.so/blog',      summary: 'Notion and Salesforce partner for bidirectional CRM data sync into Notion databases.',                                   llm_insight: 'Notion\'s bidirectional Salesforce integration turns Notion into a lightweight CRM layer for teams that find Salesforce too heavy for day-to-day use. This makes Notion significantly stickier in revenue-team workflows that previously treated it as documentation only.',                               detected_at: ago(9)  },
  { company: 'Figma',     type: 'PRODUCT_LAUNCH',  title: 'Figma Dev Mode goes GA with VS Code extension',                         url: 'https://figma.com/blog',      summary: 'Figma Dev Mode is generally available with VS Code integration and auto-generated CSS.',                                  llm_insight: 'Figma Dev Mode GA with VS Code integration removes the last major friction point between design and code handoff. Design-to-code platforms that have been selling handoff tooling as a standalone product should reassess whether their core use case still justifies a separate contract.',               detected_at: ago(4)  },
  { company: 'Figma',     type: 'PRODUCT_LAUNCH',  title: 'Figma launches Slides, taking on Google Slides and PowerPoint',         url: 'https://figma.com/blog',      summary: 'Figma Slides lets teams build presentations using Figma components and real-time collaboration.',                       llm_insight: 'Figma Slides entering the presentation market with component-based design puts Google Slides and PowerPoint at risk with design-forward teams. Marketing and product orgs that already live in Figma will adopt this before evaluating any external alternative.',                                         detected_at: ago(7)  },
]

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const userId   = session.user.id

  // Clear existing demo data first
  const demoNames = DEMO_COMPANIES.map(c => c.name)
  await supabase.from('companies').delete().eq('user_id', userId).in('name', demoNames)

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
  if (sigErr) {
    return NextResponse.json({ error: `Signal insert failed: ${sigErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ seeded: true, companies: companies.length, signals: signals.length })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const demoNames = DEMO_COMPANIES.map(c => c.name)
  await supabase.from('companies').delete().eq('user_id', session.user.id).in('name', demoNames)
  return NextResponse.json({ cleared: true })
}
