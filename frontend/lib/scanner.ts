import { createServiceClient } from '@/lib/supabase'
import { analyzeSignal } from '@/lib/claude'
import type { SignalType } from '@/lib/types'

const FETCH_HEADERS = { 'User-Agent': 'Molocule/1.0 (signal scanner)' }
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

export interface ScanResult {
  signals_found: number
  sources: string[]
  errors: string[]
}

export async function scanCompany(company: {
  id: string
  name: string
  website: string
  blog_rss_url: string | null
}): Promise<ScanResult> {
  const result: ScanResult = { signals_found: 0, sources: [], errors: [] }

  const tasks: Promise<number>[] = [
    scanGoogleNews(company.id, company.name).catch((e) => { result.errors.push(`Google News: ${e?.message}`); return 0 }),
    scanHackerNews(company.id, company.name).catch((e) => { result.errors.push(`HN: ${e?.message}`); return 0 }),
  ]

  if (company.blog_rss_url) {
    tasks.push(
      scanRSS(company.id, company.name, company.blog_rss_url).catch((e) => {
        result.errors.push(`RSS: ${e?.message}`); return 0
      })
    )
  }

  const counts = await Promise.all(tasks)
  result.signals_found = counts.reduce((a, b) => a + b, 0)
  if (counts[0] > 0) result.sources.push('Google News')
  if (counts[1] > 0) result.sources.push('Hacker News')
  if ((counts[2] ?? 0) > 0) result.sources.push('Blog RSS')

  return result
}

async function scanGoogleNews(companyId: string, companyName: string): Promise<number> {
  // Google News RSS — free, no API key
  const q = encodeURIComponent(`"${companyName}"`)
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`

  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return 0

  const xml = await res.text()
  const items = parseRSSItems(xml).slice(0, 8)
  return pushSignals(companyId, companyName, items, 'GENERAL')
}

async function scanHackerNews(companyId: string, companyName: string): Promise<number> {
  // HN Algolia search — free, no API key
  const q = encodeURIComponent(companyName)
  const url = `https://hn.algolia.com/api/v1/search?query=${q}&tags=story&hitsPerPage=5&numericFilters=created_at_i>${Math.floor((Date.now() - SEVEN_DAYS) / 1000)}`

  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return 0

  const json = await res.json() as { hits: Array<{ title: string; url?: string; story_text?: string; objectID: string }> }
  const items = (json.hits ?? []).map((h) => ({
    title: h.title,
    link: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    description: h.story_text?.slice(0, 300) ?? '',
    pubDate: undefined as string | undefined,
  }))

  return pushSignals(companyId, companyName, items, null)
}

async function scanRSS(companyId: string, companyName: string, rssUrl: string): Promise<number> {
  const res = await fetch(rssUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return 0

  const xml = await res.text()
  const items = parseRSSItems(xml)
    .filter((item) => !item.pubDate || new Date(item.pubDate).getTime() > Date.now() - SEVEN_DAYS)
    .slice(0, 5)

  return pushSignals(companyId, companyName, items, null)
}

async function pushSignals(
  companyId: string,
  companyName: string,
  items: Array<{ title: string; link: string; description?: string; pubDate?: string }>,
  forceType: SignalType | null
): Promise<number> {
  const supabase = createServiceClient()
  let count = 0
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS).toISOString()

  for (const item of items) {
    if (!item.title?.trim()) continue

    // Deduplication check
    const { data: existing } = await supabase
      .from('signals')
      .select('id')
      .eq('company_id', companyId)
      .eq('title', item.title.trim())
      .gte('detected_at', sevenDaysAgo)
      .limit(1)
      .maybeSingle()

    if (existing) continue

    const type = forceType ?? classifyContent(item.title, item.description ?? '')
    const insight = await analyzeSignal({
      companyName,
      signalType: type,
      title: item.title,
      summary: item.description ?? '',
    })

    const { error } = await supabase.from('signals').insert({
      company_id: companyId,
      type,
      title: item.title.trim(),
      url: item.link,
      summary: item.description?.slice(0, 500),
      llm_insight: insight,
      is_new: true,
    })

    if (!error) count++
  }

  return count
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseRSSItems(xml: string) {
  const items: Array<{ title: string; link: string; description?: string; pubDate?: string }> = []
  const matches = Array.from(xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi))
  for (const m of matches) {
    const c = m[1]
    const title = extractTag(c, 'title')
    const link  = extractTag(c, 'link')
    if (!title || !link) continue
    items.push({
      title:       stripCDATA(title),
      link:        stripCDATA(link),
      description: stripCDATA(extractTag(c, 'description') ?? ''),
      pubDate:     extractTag(c, 'pubDate') ?? undefined,
    })
  }
  return items
}

function extractTag(xml: string, tag: string): string | null {
  return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1]?.trim() ?? null
}

function stripCDATA(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

export function classifyContent(title: string, body: string): SignalType {
  const t = (title + ' ' + body).toLowerCase()
  if (/\$[\d,]+ ?m(?:illion)?|series [a-e]|raised|funding round|investment|venture capital|seed round/.test(t)) return 'FUNDING'
  if (/layoff|laid off|reduction in force|workforce reduction|downsiz|job cuts/.test(t)) return 'LAYOFF'
  if (/\bhired\b|joins as|appoints|new cto|new ceo|new coo|new vp|head of|chief [a-z]+ officer/.test(t)) return 'KEY_HIRE'
  if (/\blaunch(ed|es)?\b|announce[sd]?|new product|general availability|\bga\b|ship(ped|s)?\b|release/.test(t)) return 'PRODUCT_LAUNCH'
  return 'GENERAL'
}
