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
  if (fromHostname && title.toLowerCase().startsWith(fromHostname.toLowerCase())) {
    const rest = title.slice(fromHostname.length).trim()
    const startsWithSep = !rest || rest.startsWith('|') || rest.startsWith(':') ||
      rest.startsWith('-') || rest.startsWith('–') || rest.startsWith('—')
    if (startsWithSep) return fromHostname
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
const RSS_GUESSES = ['/feed', '/feed.xml', '/rss', '/rss.xml', '/blog/feed', '/blog/rss.xml', '/atom.xml']

async function fetchSiteMetadata(url: string): Promise<{
  title: string | null
  description: string | null
  rssUrl: string | null
  linkedInUrl: string | null
}> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Molocule-Enricher/1.0 (signal tracker)' },
    })
    if (!res.ok) return { title: null, description: null, rssUrl: null, linkedInUrl: null }

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

    // Extract LinkedIn company URL from any link in the page HTML
    const linkedInMatch = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/company\/([a-zA-Z0-9_-]+)/i)
    const linkedInUrl = linkedInMatch ? `https://www.linkedin.com/company/${linkedInMatch[1]}` : null

    return {
      title: ogTitle?.trim() ?? null,
      description: ogDesc?.trim().slice(0, 300) ?? null,
      rssUrl: rssRaw ? resolveUrl(url, rssRaw) : null,
      linkedInUrl,
    }
  } catch {
    return { title: null, description: null, rssUrl: null, linkedInUrl: null }
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

async function findGithubOrg(name: string, token?: string): Promise<string | null> {
  if (!token) return null
  try {
    const octokit = new Octokit({ auth: token })
    const { data } = await octokit.search.users({ q: `${name} type:org`, per_page: 3 })
    // Only accept if the login closely matches the company name
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const best = data.items.find(item => {
      const login = item.login.toLowerCase().replace(/[^a-z0-9]/g, '')
      return login === slug || login.includes(slug) || slug.includes(login)
    })
    return best?.login ?? data.items[0]?.login ?? null
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

  const [metaResult, orgResult] = await Promise.allSettled([
    fetchSiteMetadata(websiteUrl),
    findGithubOrg(companyName, session.user.accessToken),
  ])

  const meta = metaResult.status === 'fulfilled'
    ? metaResult.value
    : { title: null, description: null, rssUrl: null, linkedInUrl: null }
  const org = orgResult.status === 'fulfilled' ? orgResult.value : null

  // If RSS not found in HTML, probe common paths
  let rssUrl = meta.rssUrl
  if (!rssUrl) rssUrl = await guessRssUrl(websiteUrl)

  let faviconUrl: string | null = null
  try { faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(websiteUrl).hostname}&sz=64` } catch {}

  const enrichment: CompanyEnrichment = {
    name:         cleanCompanyName(meta.title, companyName, websiteUrl),
    website:      websiteUrl,
    description:  meta.description,
    github_org:   org,
    blog_rss_url: rssUrl,
    favicon_url:  faviconUrl,
    linkedin_url: meta.linkedInUrl,
    found: {
      github:   !!org,
      rss:      !!rssUrl,
      linkedin: !!meta.linkedInUrl,
    },
  }

  return NextResponse.json(enrichment)
}
