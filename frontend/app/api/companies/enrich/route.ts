export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { Octokit } from '@octokit/rest'
import type { CompanyEnrichment } from '@/lib/types'

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (trimmed.includes('.')) return `https://${trimmed}`
  return `https://${trimmed.toLowerCase().replace(/\s+/g, '')}.com`
}

function nameFromHostname(websiteUrl: string): string | null {
  try {
    const hostname = new URL(websiteUrl).hostname.replace(/^www\./, '')
    const domain = hostname.split('.')[0]
    if (!domain || domain.length < 2) return null
    return domain.charAt(0).toUpperCase() + domain.slice(1)
  } catch {
    return null
  }
}

// Tagline / filler words that should never be the company name on their own
const TAGLINE_RE = /\b(welcome|official|site|home|homepage|about|visit|solutions|services|products|platform|software|technology|technologies|computing|delivers|leadership|advance)\b/i

function cleanCompanyName(rawTitle: string | null, fallbackInput: string, websiteUrl: string): string {
  const fromHostname = nameFromHostname(websiteUrl)

  if (!rawTitle) return fromHostname ?? fallbackInput.trim()

  const title = rawTitle.trim()

  // Strip greeting prefixes: "Welcome to AMD", "About Stripe", "Visit Intel"
  const greetingMatch = title.match(/^(?:welcome\s+to|about|visit|explore|introducing|home\s*[-:]\s*)\s*(.+)$/i)
  if (greetingMatch) {
    // Remove everything from a separator onward (pipe, colon, em-dashes, hyphen)
    const candidate = greetingMatch[1].split(/\s*(?:||:|–|—|-)\s*/)[0].trim()
    if (candidate.length >= 2 && candidate.length <= 40) return candidate
  }

  // Split on separators; pick the shortest segment that doesn't look like a tagline
  const separators = [' | ', ' - ', ' — ', ' – ', ' · ', ': ', ' : ']
  for (const sep of separators) {
    if (title.includes(sep)) {
      const parts = title.split(sep).map(p => p.trim()).filter(p => p.length >= 2 && p.length <= 40)
      const brandParts = parts.filter(p => !TAGLINE_RE.test(p))
      if (brandParts.length > 0) {
        return brandParts.sort((a, b) => a.length - b.length)[0]
      }
    }
  }

  // "Company.com. Tagline" pattern
  const dotTagline = title.match(/^([^.]+)\.(com|io|co|net|org|app|ai)\b/i)
  if (dotTagline) return dotTagline[1].trim()

  // Title begins with the hostname-derived name, rest is clearly a tagline
  // Return the og:title's slice (correct casing e.g. "OpenAI") not fromHostname ("Openai")
  if (fromHostname && title.toLowerCase().startsWith(fromHostname.toLowerCase())) {
    const rest = title.slice(fromHostname.length).trim()
    const startsWithSep = !rest || rest.startsWith('|') || rest.startsWith(':') ||
      rest.startsWith('-') || rest.startsWith('–') || rest.startsWith('—')
    if (startsWithSep) return title.slice(0, fromHostname.length).trim() || fromHostname
  }

  // If the title doesn't mention the company name at all it's a pure tagline
  // e.g. ramp.com returns "Spend Smarter" — use "Ramp" from hostname instead
  if (fromHostname && !title.toLowerCase().includes(fromHostname.toLowerCase())) {
    return fromHostname
  }

  // Full title is short and clean, no separator characters, use as-is
  const hasSeparator = title.includes('|') || title.includes(':') || title.includes('–') || title.includes('—')
  if (title.length <= 28 && !TAGLINE_RE.test(title) && !hasSeparator) return title

  return fromHostname ?? fallbackInput.trim()
}

function resolveUrl(base: string, path: string): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  try { return new URL(path, base).href } catch { return path }
}

// Common RSS path suffixes to try when the <link> tag is missing
const RSS_GUESSES = [
  '/feed', '/feed.xml', '/rss', '/rss.xml', '/rss/',
  '/blog/feed', '/blog/feed.xml', '/blog/rss.xml', '/blog/rss/', '/blog/atom.xml',
  '/news/feed', '/news/rss.xml',
  '/atom.xml', '/feeds/posts/default',
  '/posts/feed', '/articles/feed', '/updates/feed',
]

const GITHUB_SKIP = new Set([
  'login', 'signup', 'about', 'contact', 'features', 'pricing', 'topics',
  'explore', 'marketplace', 'sponsors', 'orgs', 'settings', 'notifications',
  'issues', 'pulls', 'readme', 'docs', 'blog', 'security', 'enterprise',
])

async function fetchSiteMetadata(url: string): Promise<{
  title: string | null
  description: string | null
  rssUrl: string | null
  linkedInUrl: string | null
  githubOrg: string | null
}> {
  const empty = { title: null, description: null, rssUrl: null, linkedInUrl: null, githubOrg: null }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Molocule-Enricher/1.0 (signal tracker)' },
    })
    if (!res.ok) return empty

    const html = await res.text()

    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1]
      ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
      ?? null

    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]
      ?? null

    const rssRaw = html.match(/<link[^>]+type=["']application\/rss\+xml["'][^>]+href=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/rss\+xml["']/i)?.[1]
      ?? html.match(/<link[^>]+type=["']application\/atom\+xml["'][^>]+href=["']([^"']+)["']/i)?.[1]
      ?? null

    // LinkedIn from any link in page HTML
    const linkedInMatch = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/company\/([a-zA-Z0-9_-]+)/i)
    const linkedInUrl = linkedInMatch ? `https://www.linkedin.com/company/${linkedInMatch[1]}` : null

    // GitHub org from any link in page HTML — most companies link their org in footer/header
    const githubMatches = [...html.matchAll(/https?:\/\/github\.com\/([a-zA-Z0-9_-]+)/gi)]
    const githubOrg = githubMatches
      .map(m => m[1])
      .find(org => org && !GITHUB_SKIP.has(org.toLowerCase())) ?? null

    return {
      title: ogTitle?.trim() ?? null,
      description: ogDesc?.trim().slice(0, 300) ?? null,
      rssUrl: rssRaw ? resolveUrl(url, rssRaw) : null,
      linkedInUrl,
      githubOrg,
    }
  } catch {
    return empty
  } finally {
    clearTimeout(timer)
  }
}

// Probe common RSS paths in parallel, return the first hit, bail after 2.5s
async function guessRssUrl(baseUrl: string): Promise<string | null> {
  const origin = (() => { try { return new URL(baseUrl).origin } catch { return null } })()
  if (!origin) return null

  const checks = RSS_GUESSES.map(path =>
    fetch(origin + path, {
      signal: AbortSignal.timeout(2500),
      headers: { 'User-Agent': 'Molocule-Enricher/1.0' },
      method: 'HEAD', // HEAD is faster, just check status + content-type
    }).then(res => {
      const ct = res.headers.get('content-type') ?? ''
      if (res.ok && /xml|rss|atom/.test(ct)) return origin + path
      return null
    }).catch(() => null)
  )

  const results = await Promise.all(checks)
  return results.find(r => r !== null) ?? null
}

async function findGithubOrg(name: string, websiteUrl: string, token?: string, htmlOrg?: string | null): Promise<string | null> {
  if (!token) return null
  try {
    const octokit = new Octokit({ auth: token })
    const companyDomain = (() => { try { return new URL(websiteUrl).hostname.replace(/^www\./, '') } catch { return '' } })()
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '')

    // Best signal: GitHub org link found directly in website HTML
    if (htmlOrg) {
      try {
        await octokit.orgs.get({ org: htmlOrg })
        return htmlOrg
      } catch { /* not a valid org, fall through */ }
    }

    // Try common slug variants directly before hitting the search API
    const variants = [slug, `${slug}-ai`, `${slug}-labs`, `${slug}-hq`, `${slug}-inc`, `${slug}-io`]
    for (const v of variants) {
      try {
        const { data: org } = await octokit.orgs.get({ org: v })
        const orgSite = (org.blog ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
        if (!companyDomain || orgSite.includes(companyDomain) || org.login.toLowerCase().replace(/[^a-z0-9]/g, '') === slug) {
          return org.login
        }
      } catch { /* not found, try next */ }
    }

    // Search API as fallback
    const { data } = await octokit.search.users({ q: `${name} type:org`, per_page: 10 })

    for (const item of data.items) {
      try {
        const { data: org } = await octokit.orgs.get({ org: item.login })
        const orgSite = (org.blog ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
        if (companyDomain && orgSite.includes(companyDomain)) return item.login
        const orgName = (org.name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
        if (orgName && orgName === slug) return item.login
      } catch { /* skip */ }
    }

    // Strict login slug match
    const strict = data.items.find(item => item.login.toLowerCase().replace(/[^a-z0-9]/g, '') === slug)
    if (strict) return strict.login

    // Partial match only if very close
    const partial = data.items.find(item => {
      const login = item.login.toLowerCase().replace(/[^a-z0-9]/g, '')
      return login.startsWith(slug) || slug.startsWith(login)
    })
    return partial?.login ?? null
  } catch {
    return null
  }
}


export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const input: string = body.input ?? ''
  if (!input.trim()) return NextResponse.json({ error: 'input required' }, { status: 400 })

  const websiteUrl = normalizeUrl(input)
  const companyName = input.trim()

  // Fetch site metadata first so the GitHub org found in HTML can inform the org lookup
  const meta = await fetchSiteMetadata(websiteUrl).catch(() => ({ title: null, description: null, rssUrl: null, linkedInUrl: null, githubOrg: null }))
  const org = await findGithubOrg(companyName, websiteUrl, session.user.accessToken, meta.githubOrg).catch(() => null)

  // If RSS not found in HTML, probe common paths then try Substack
  let rssUrl = meta.rssUrl
  if (!rssUrl) rssUrl = await guessRssUrl(websiteUrl)
  if (!rssUrl) {
    const resolvedSlug = cleanCompanyName(meta.title, companyName, websiteUrl).toLowerCase().replace(/[^a-z0-9]/g, '')
    const substackUrl = `https://${resolvedSlug}.substack.com/feed`
    try {
      const r = await fetch(substackUrl, { method: 'HEAD', signal: AbortSignal.timeout(2500) })
      if (r.ok) rssUrl = substackUrl
    } catch { /* not on Substack */ }
  }

  // Try to find LinkedIn: GitHub org profile, then slug guess
  const resolvedName = cleanCompanyName(meta.title, companyName, websiteUrl)
  let linkedInUrl = meta.linkedInUrl
  if (!linkedInUrl && org && session.user.accessToken) {
    try {
      const octokit = new Octokit({ auth: session.user.accessToken })
      const { data: ghOrg } = await octokit.orgs.get({ org })
      const match = (ghOrg.blog ?? '').match(/linkedin\.com\/company\/([a-zA-Z0-9_-]+)/i)
        ?? (ghOrg.html_url ?? '').match(/linkedin\.com\/company\/([a-zA-Z0-9_-]+)/i)
      if (match) linkedInUrl = `https://www.linkedin.com/company/${match[1]}`
    } catch { /* not critical */ }
  }

  let faviconUrl: string | null = null
  try { faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(websiteUrl).hostname}&sz=64` } catch {}

  const enrichment: CompanyEnrichment = {
    name:         resolvedName,
    website:      websiteUrl,
    description:  meta.description,
    github_org:   org,
    blog_rss_url: rssUrl,
    favicon_url:  faviconUrl,
    linkedin_url: linkedInUrl,
    found: {
      github:   !!org,
      rss:      !!rssUrl,
      linkedin: !!linkedInUrl,
    },
  }

  return NextResponse.json(enrichment)
}
