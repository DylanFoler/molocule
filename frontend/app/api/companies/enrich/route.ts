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

function resolveUrl(base: string, path: string): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  try {
    return new URL(path, base).href
  } catch {
    return path
  }
}

async function fetchSiteMetadata(url: string): Promise<{
  title: string | null
  description: string | null
  rssUrl: string | null
}> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Molocule-Enricher/1.0 (signal tracker)' },
    })
    if (!res.ok) return { title: null, description: null, rssUrl: null }

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
      ?? null

    return {
      title: ogTitle?.trim() ?? null,
      description: ogDesc?.trim().slice(0, 300) ?? null,
      rssUrl: rssRaw ? resolveUrl(url, rssRaw) : null,
    }
  } catch {
    return { title: null, description: null, rssUrl: null }
  } finally {
    clearTimeout(timer)
  }
}

async function findGithubOrg(name: string, token?: string): Promise<string | null> {
  if (!token) return null
  try {
    const octokit = new Octokit({ auth: token })
    const { data } = await octokit.search.users({
      q: `${name} type:org`,
      per_page: 3,
    })
    return data.items[0]?.login ?? null
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

  const meta = metaResult.status === 'fulfilled' ? metaResult.value : { title: null, description: null, rssUrl: null }
  const org  = orgResult.status  === 'fulfilled' ? orgResult.value  : null

  let faviconUrl: string | null = null
  try {
    faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(websiteUrl).hostname}&sz=64`
  } catch {}

  const enrichment: CompanyEnrichment = {
    name:        meta.title ?? companyName,
    website:     websiteUrl,
    description: meta.description,
    github_org:  org,
    blog_rss_url: meta.rssUrl,
    favicon_url: faviconUrl,
  }

  return NextResponse.json(enrichment)
}
