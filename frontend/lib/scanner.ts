import { createServiceClient } from '@/lib/supabase'
import { analyzeSignal } from '@/lib/claude'
import type { SignalType } from '@/lib/types'

const HEADERS = { 'User-Agent': 'Molocule/1.0 (signal scanner)' }
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

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

  const tasks: Promise<{ count: number; source: string }>[] = [
    scanGoogleNews(company.id, company.name).then(c => ({ count: c, source: 'Google News' })).catch(e => { result.errors.push(`Google News: ${e?.message}`); return { count: 0, source: '' } }),
    scanHackerNews(company.id, company.name).then(c => ({ count: c, source: 'Hacker News' })).catch(e => { result.errors.push(`HN: ${e?.message}`); return { count: 0, source: '' } }),
  ]

  if (company.blog_rss_url) {
    tasks.push(
      scanRSS(company.id, company.name, company.blog_rss_url)
        .then(c => ({ count: c, source: 'Blog RSS' }))
        .catch(e => { result.errors.push(`RSS: ${e?.message}`); return { count: 0, source: '' } })
    )
  }

  const results = await Promise.all(tasks)
  for (const r of results) {
    result.signals_found += r.count
    if (r.count > 0 && r.source) result.sources.push(r.source)
  }

  return result
}

async function scanGoogleNews(companyId: string, companyName: string): Promise<number> {
  const q = encodeURIComponent(`"${companyName}"`)
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return 0
  const items = parseRSSItems(await res.text())
    .filter(i => isQualitySignal(i.title, i.description ?? '', companyName))
    .slice(0, 6)
  return pushSignals(companyId, companyName, items)
}

async function scanHackerNews(companyId: string, companyName: string): Promise<number> {
  const since = Math.floor((Date.now() - SEVEN_DAYS_MS) / 1000)
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(companyName)}&tags=story&hitsPerPage=5&numericFilters=created_at_i>${since}`
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return 0
  const json = await res.json() as { hits: Array<{ title: string; url?: string; story_text?: string; objectID: string }> }
  const items = (json.hits ?? [])
    .map(h => ({ title: h.title, link: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`, description: h.story_text?.slice(0, 300) ?? '', pubDate: undefined as string | undefined }))
    .filter(i => isQualitySignal(i.title, i.description, companyName))
  return pushSignals(companyId, companyName, items)
}

async function scanRSS(companyId: string, companyName: string, rssUrl: string): Promise<number> {
  const res = await fetch(rssUrl, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return 0
  const items = parseRSSItems(await res.text())
    .filter(i => !i.pubDate || new Date(i.pubDate).getTime() > Date.now() - SEVEN_DAYS_MS)
    .slice(0, 5)
  return pushSignals(companyId, companyName, items)
}

// Quality filter: skip scams, SEO spam, obviously irrelevant articles
function isQualitySignal(title: string, body: string, companyName: string): boolean {
  const t = title.toLowerCase()
  // Skip spam/scam articles
  if (/scam|fraud|fake|phish|unauthorized sale|ponzi|pyramid|hack(?:ed|ers)/.test(t)) return false
  // Skip trivially generic titles
  if (t.length < 15) return false
  // Must mention the company name (case-insensitive)
  const nameSlug = companyName.toLowerCase().split(/\s+/)[0]
  if (!title.toLowerCase().includes(nameSlug)) return false
  return true
}

async function pushSignals(
  companyId: string,
  companyName: string,
  items: Array<{ title: string; link: string; description?: string; pubDate?: string }>
): Promise<number> {
  const supabase = createServiceClient()
  let count = 0
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

  for (const item of items) {
    if (!item.title?.trim()) continue
    const { data: existing } = await supabase
      .from('signals').select('id').eq('company_id', companyId).eq('title', item.title.trim())
      .gte('detected_at', cutoff).limit(1).maybeSingle()
    if (existing) continue

    const type = classifyContent(item.title, item.description ?? '')
    const insight = await analyzeSignal({ companyName, signalType: type, title: item.title, summary: item.description ?? '' })

    const { error } = await supabase.from('signals').insert({
      company_id: companyId, type, title: item.title.trim(),
      url: item.link, summary: item.description?.slice(0, 500),
      llm_insight: insight, is_new: true,
    })
    if (!error) count++
  }
  return count
}

function parseRSSItems(xml: string) {
  const items: Array<{ title: string; link: string; description?: string; pubDate?: string }> = []
  for (const m of Array.from(xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi))) {
    const c = m[1]
    const title = extractTag(c, 'title'); const link = extractTag(c, 'link')
    if (!title || !link) continue
    items.push({ title: stripCDATA(title), link: stripCDATA(link), description: stripCDATA(extractTag(c, 'description') ?? ''), pubDate: extractTag(c, 'pubDate') ?? undefined })
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
  // Explicit exclusions first
  if (/scam|fraud|fake|phish|unauthorized/.test(t)) return 'GENERAL'
  if (/\$[\d,]+ ?(?:m(?:illion)?|b(?:illion)?)|series [a-e] round|raised \$|funding round|venture capital|seed round|lead investor/.test(t)) return 'FUNDING'
  if (/layoff|laid off|reduction in force|workforce reduction|downsiz|job cuts|employees? let go/.test(t)) return 'LAYOFF'
  if (/\bhired?\b|joins as|appoints?|new (?:cto|ceo|coo|cpo|vp|president|head of)|chief [a-z]+ officer/.test(t)) return 'KEY_HIRE'
  if (/\blaunch(?:ed|es)?\b|announc(?:ed|es|ing)|new product|generally available|releases?|ships?|debut/.test(t)) return 'PRODUCT_LAUNCH'
  return 'GENERAL'
}
