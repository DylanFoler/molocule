export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

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
const ago = (d: number) => new Date(Date.now() - d * DAY)

const DEMO_SIGNALS = [
  { company: 'Stripe',    type: 'FUNDING',       title: 'Stripe raises $694M at $65B valuation in secondary share sale',         url: 'https://stripe.com/newsroom', summary: 'Stripe completed a $694M secondary share sale valuing the company at $65B ahead of a potential IPO.',               llm_insight: 'Stripe\'s $694M secondary at $65B confirms IPO preparation is underway. New enterprise sales motions will take shape as fresh capital gets deployed into go-to-market over the next two quarters.',                                                                                             daysAgo: 1  },
  { company: 'Stripe',    type: 'KEY_HIRE',      title: 'Stripe appoints new Chief Revenue Officer from Salesforce',             url: 'https://stripe.com/newsroom', summary: 'Stripe hired a former Salesforce SVP as its new CRO to lead global enterprise sales expansion.',                     llm_insight: 'A Salesforce SVP entering Stripe as CRO signals the company is professionalizing its enterprise sales org beyond founder-led growth. Expect structured territory planning and enterprise packaging changes within 180 days.',                                                                   daysAgo: 3  },
  { company: 'Stripe',    type: 'PRODUCT_LAUNCH',title: 'Stripe launches Stablecoin Financial Accounts in 101 countries',        url: 'https://stripe.com/blog',     summary: 'Stripe now lets businesses hold and send stablecoin payments in 101 countries.',                                       llm_insight: 'Stablecoin accounts in 101 countries repositions Stripe as infrastructure for digital asset treasury management, not just payment processing. This competes directly with B2B crypto payment platforms that have been building this layer independently.',                                    daysAgo: 5  },
  { company: 'Vercel',    type: 'PRODUCT_LAUNCH',title: 'Vercel ships v0 2.0 with full-stack generation and one-click deploy',   url: 'https://vercel.com/blog',     summary: 'v0 now generates complete Next.js apps from natural language and deploys them in one click.',                           llm_insight: 'v0 2.0 compresses the time from idea to deployed full-stack app, directly threatening low-code platforms that have been targeting the same non-technical builder segment. Vercel now controls the entire development surface for a growing share of production apps.',                        daysAgo: 2  },
  { company: 'Vercel',    type: 'FUNDING',       title: 'Vercel raises $250M Series E at $3.25B valuation',                      url: 'https://vercel.com/blog',     summary: 'Vercel raised $250M Series E to accelerate enterprise sales and global infrastructure expansion.',                    llm_insight: 'Vercel\'s $250M Series E is targeted at enterprise infrastructure and global sales expansion. The company is shifting from dev tool to enterprise platform, which will change how procurement conversations are structured at companies over 500 employees.',                                 daysAgo: 8  },
  { company: 'Anthropic', type: 'FUNDING',       title: 'Anthropic closes $2.75B Series E funding led by Google',                url: 'https://anthropic.com/news',  summary: 'Anthropic raised $2.75B Series E with Google as lead investor, bringing total raised to over $7B.',                    llm_insight: 'Google leading Anthropic\'s Series E at $2.75B deepens the strategic dependency between both companies. Anthropic\'s enterprise API positioning now carries Google\'s cloud distribution as an implicit advantage in evaluations against OpenAI.',                                            daysAgo: 4  },
  { company: 'Anthropic', type: 'PRODUCT_LAUNCH',title: 'Anthropic releases Claude 4 Opus with 1M token context',                url: 'https://anthropic.com/news',  summary: 'Claude 4 Opus features extended thinking, computer use, and a one-million token context window.',                      llm_insight: 'Claude 4 Opus with computer-use and 1M token context competes directly with enterprise workflow automation platforms that depend on human-in-the-loop task completion. Companies building automation layers on older models should evaluate whether this capability makes their integration redundant.',    daysAgo: 6  },
  { company: 'Linear',    type: 'PRODUCT_LAUNCH',title: 'Linear 2.0 ships with AI project scoping and redesigned roadmaps',      url: 'https://linear.app/blog',     summary: 'Linear 2.0 brings AI-assisted project planning and automatic milestone generation.',                                    llm_insight: 'Linear 2.0 adding AI project scoping puts it in direct competition with Jira\'s AI roadmap features and Notion\'s planning expansion. Linear\'s opinionated approach will accelerate adoption among engineering teams that find Jira\'s complexity a liability.',                           daysAgo: 3  },
  { company: 'Rippling',  type: 'KEY_HIRE',      title: 'Rippling hires Salesforce SVP as Chief Revenue Officer',                url: 'https://rippling.com/blog',   summary: 'Rippling appointed a former Salesforce SVP of Sales as CRO to lead enterprise sales build-out.',                       llm_insight: 'Rippling hiring a Salesforce SVP as CRO mirrors Stripe\'s enterprise playbook from two years ago. HR platforms in the mid-market segment will face a more structured competitive motion from Rippling within the next two quarters.',                                                        daysAgo: 2  },
  { company: 'Brex',      type: 'LAYOFF',        title: 'Brex lays off 282 employees as it exits the SMB market',                url: 'https://brex.com/blog',       summary: 'Brex cut 282 employees and pivoted exclusively to enterprise customers.',                                               llm_insight: 'Brex cutting 282 employees while exiting SMB is a permanent strategic pivot, not a cost cut. The 282 freed SMB seats will migrate to Ramp, Divvy, or Mercury over the next 90 days as customers who can\'t meet Brex\'s new enterprise minimums look for alternatives.',                    daysAgo: 5  },
  { company: 'Notion',    type: 'PRODUCT_LAUNCH',title: 'Notion AI launches meeting notes and document Q&A',                     url: 'https://notion.so/blog',      summary: 'Notion expanded AI to meeting note generation and document-aware Q&A.',                                                 llm_insight: 'Notion AI expanding into meeting notes directly attacks Otter.ai and Fireflies in a market those companies built without a bundled workspace advantage. Meeting intelligence bundled into Notion removes a standalone budget line for teams already paying for the platform.',                 daysAgo: 1  },
  { company: 'Figma',     type: 'PRODUCT_LAUNCH',title: 'Figma Dev Mode goes GA with VS Code extension',                         url: 'https://figma.com/blog',      summary: 'Figma Dev Mode is generally available with VS Code integration and auto-generated CSS.',                                  llm_insight: 'Figma Dev Mode GA with VS Code integration removes the last major friction point between design and code handoff. Design-to-code platforms that have been selling handoff tooling as a standalone product should reassess whether their core use case still justifies a separate contract.',   daysAgo: 4  },
]

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  // Ensure user exists
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: session.user.email ?? '', name: session.user.name, image: session.user.image },
  })

  // Clear existing demo data
  const demoNames = DEMO_COMPANIES.map(c => c.name)
  await prisma.company.deleteMany({ where: { user_id: userId, name: { in: demoNames } } })

  // Insert companies
  await prisma.company.createMany({
    data: DEMO_COMPANIES.map(c => ({ user_id: userId, ...c })),
  })

  const companies = await prisma.company.findMany({
    where: { user_id: userId, name: { in: demoNames } },
    select: { id: true, name: true },
  })

  const nameToId = Object.fromEntries(companies.map(c => [c.name, c.id]))

  // Insert signals
  const signals = DEMO_SIGNALS.filter(s => nameToId[s.company]).map(s => ({
    company_id: nameToId[s.company],
    type: s.type, title: s.title, url: s.url, summary: s.summary, llm_insight: s.llm_insight,
    is_new: s.daysAgo <= 2,
    detected_at: ago(s.daysAgo),
  }))

  await prisma.signal.createMany({ data: signals })

  return NextResponse.json({ seeded: true, companies: companies.length, signals: signals.length })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const demoNames = DEMO_COMPANIES.map(c => c.name)
  await prisma.company.deleteMany({ where: { user_id: session.user.id, name: { in: demoNames } } })
  return NextResponse.json({ cleared: true })
}
