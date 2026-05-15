import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { Octokit } from '@octokit/rest'
import type { CompanyEnrichment } from '@/lib/types'

const HEADERS = { 'User-Agent': 'Molocule-Enricher/1.0' }
const RSS_PATTERNS = [
  '/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml',
  '/blog/feed', '/blog/rss', '/blog/feed.xml', '/blog/rss.xml',
  '/feeds/posts/default',
]

// ── URL normalization ──────────────────────────────────────────────────────

function normalizeUrl(input: string): string {
  const t = input.trim()
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  if (t.includes('.')) return `https://${t}`
  return `https://${t.toLowerCase().replace(/\s+/g, '')}.com`
}

function extractDomainSlug(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host.split('.')[0]
  } catch {
    return ''
  }
}

// ── Title cleaning ─────────────────────────────────────────────────────────
// Strips marketing subtitles: "Stripe | Payment Platform" -> "Stripe"

function cleanTitle(raw: string | null): string | null {
  if (!raw) return null
  return raw
    .replace(/\s*[\|–—]\s+.+$/, '')      // strip from | – —
    .replace(/\s+-\s+[A-Z].{8,}$/, '')    // strip " - Long subtitle" (capital letter + enough chars)
    .replace(/:\s+[A-Z].{8,}$/, '')       // strip ": Long subtitle"
    .trim() || null
}

// ── Site metadata ──────────────────────────────────────────────────────────

interface SiteMeta {
  title: string | null
  description: string | null
  rssUrl: string | null
  linkedinUrl: string | null
  html: string
}

async function fetchSiteMeta(url: string): Promise<SiteMeta> {
  const empty: SiteMeta = { title: null, description: null, rssUrl: null, linkedinUrl: null, html: '' }
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(7000) })
    if (!res.ok) return empty
    const html = await res.text()

    // Title: prefer og:title, fallback <title>
    const rawTitle =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ??
      null

    // Description
    const description =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)?.[1] ??
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1] ??
      null

    // RSS: look for <link type="application/rss+xml">
    const rssRaw =
      html.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i)?.[1] ??
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/(?:rss|atom)\+xml["']/i)?.[1] ??
      null
    const rssUrl = rssRaw ? resolveUrl(url, rssRaw) : null

    // LinkedIn: look for linkedin.com/company/ anywhere in the HTML
    const liMatch = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/company\/([a-zA-Z0-9_-]+)/i)
    const linkedinUrl = liMatch ? `https://www.linkedin.com/company/${liMatch[1]}` : null

    return { title: rawTitle, description: description?.slice(0, 400) ?? null, rssUrl, linkedinUrl, html }
  } catch {
    return empty
  }
}

function resolveUrl(base: string, path: string): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  try { return new URL(path, base).href } catch { return path }
}

// ── RSS discovery fallback ─────────────────────────────────────────────────

async function findRSSFallback(baseUrl: string): Promise<string | null> {
  const results = await Promise.allSettled(
    RSS_PATTERNS.map(async (p) => {
      const url = new URL(p, baseUrl).href
      const res = await fetch(url, { method: 'HEAD', headers: HEADERS, signal: AbortSignal.timeout(3000) })
      if (res.ok) return url
      throw new Error('not found')
    })
  )
  const found = results.find((r) => r.status === 'fulfilled')
  return found?.status === 'fulfilled' ? found.value : null
}

// ── GitHub org ─────────────────────────────────────────────────────────────
// Strategy: try domain slug via orgs.get() first (exact match), then search.

async function findGithubOrg(companyName: string, domainSlug: string, token?: string): Promise<string | null> {
  if (!token) return null
  const octokit = new Octokit({ auth: token })

  // 1. Direct lookup by domain slug (e.g. stripe.com -> "stripe")
  if (domainSlug) {
    try {
      const { data } = await octokit.orgs.get({ org: domainSlug })
      return data.login
    } catch { /* not found */ }
  }

  // 2. Try name as slug (e.g. "Linear" -> "linear")
  const nameSlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (nameSlug && nameSlug !== domainSlug) {
    try {
      const { data } = await octokit.orgs.get({ org: nameSlug })
      return data.login
    } catch { /* not found */ }
  }

  // 3. Search API - prefer results that match the slug or name closely
  try {
    const { data } = await octokit.search.users({
      q: `${companyName} type:org`,
      per_page: 5,
    })
    if (!data.items.length) return null

    const candidates = data.items.map((i) => i.login.toLowerCase())
    // Prefer exact slug match
    for (const slug of [domainSlug, nameSlug]) {
      const match = candidates.indexOf(slug)
      if (match !== -1) return data.items[match].login
    }
    // Prefer items that start with the slug
    const startsWith = data.items.find((i) => i.login.toLowerCase().startsWith(domainSlug.slice(0, 4)))
    if (startsWith) return startsWith.login

    // Nothing reliable — skip rather than return a wrong org
    return null
  } catch {
    return null
  }
}

// ── LinkedIn fallback from slug ────────────────────────────────────────────

function buildLinkedInUrl(companyName: string): string {
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `https://www.linkedin.com/company/${slug}`
}

// ── Claude enrichment ──────────────────────────────────────────────────────

async function enrichWithClaude(
  name: string,
  rawDescription: string | null
): Promise<{ description: string; watch_for: string } | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key?.startsWith('sk-ant-')) return null

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: key })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Company: ${name}
Raw description: ${rawDescription ?? 'not available'}

Return JSON only, no markdown:
{
  "description": "2-3 sentence plain-English summary of what this company does, who their customers are, and their business model",
  "watch_for": "1-2 sentences on what signals are most worth flagging for this company (e.g. funding rounds, key exec hires, product launches, layoffs) and why"
}`,
      }],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    const json = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    return JSON.parse(json)
  } catch {
    return null
  }
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { input = '' } = await req.json().catch(() => ({}))
  if (!input.trim()) return NextResponse.json({ error: 'input required' }, { status: 400 })

  const websiteUrl  = normalizeUrl(input.trim())
  const domainSlug  = extractDomainSlug(websiteUrl)
  const companyName = input.trim()

  // Fetch site + GitHub in parallel
  const [meta, githubOrg] = await Promise.allSettled([
    fetchSiteMeta(websiteUrl),
    findGithubOrg(companyName, domainSlug, session.user.accessToken),
  ])

  const site = meta.status === 'fulfilled' ? meta.value : { title: null, description: null, rssUrl: null, linkedinUrl: null, html: '' }
  const org  = githubOrg.status === 'fulfilled' ? githubOrg.value : null

  // Clean name — strip marketing subtitles
  const cleanedName = cleanTitle(site.title) ?? companyName

  // RSS: use HTML-discovered URL, then probe common paths
  const rssUrl = site.rssUrl ?? await findRSSFallback(websiteUrl).catch(() => null)

  // LinkedIn: prefer page-extracted, fallback to slug construction
  const linkedinUrl = site.linkedinUrl ?? buildLinkedInUrl(cleanedName)

  // Favicon
  let faviconUrl: string | null = null
  try { faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(websiteUrl).hostname}&sz=64` } catch {}

  // Claude: better description + watch_for
  const ai = await enrichWithClaude(cleanedName, site.description)

  const enrichment: CompanyEnrichment = {
    name:         cleanedName,
    website:      websiteUrl,
    description:  ai?.description ?? site.description,
    github_org:   org,
    linkedin_url: linkedinUrl,
    blog_rss_url: rssUrl,
    favicon_url:  faviconUrl,
    watch_for:    ai?.watch_for ?? null,
  }

  return NextResponse.json(enrichment)
}
