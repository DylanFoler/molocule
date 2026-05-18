import { createServiceClient } from '@/lib/supabase'
import { analyzeSignal } from '@/lib/claude'
import { getSearchTerms } from '@/lib/company-aliases'
import type { SignalType } from '@/lib/types'

const HEADERS = { 'User-Agent': 'Molocule/1.0 (signal scanner)' }
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const FETCH_TIMEOUT = 5000

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

  const tasks = [
    scanGoogleNews(company.id, company.name).then(c => ({ c, src: 'Google News' })).catch(e => { result.errors.push(`News: ${e?.message}`); return { c: 0, src: '' } }),
    scanHackerNews(company.id, company.name).then(c => ({ c, src: 'Hacker News' })).catch(e => { result.errors.push(`HN: ${e?.message}`); return { c: 0, src: '' } }),
  ]

  if (company.blog_rss_url) {
    tasks.push(
      scanRSS(company.id, company.name, company.blog_rss_url)
        .then(c => ({ c, src: 'Blog' }))
        .catch(e => { result.errors.push(`RSS: ${e?.message}`); return { c: 0, src: '' } })
    )
  }

  for (const { c, src } of await Promise.all(tasks)) {
    result.signals_found += c
    if (c > 0 && src) result.sources.push(src)
  }

  return result
}

async function scanGoogleNews(companyId: string, companyName: string): Promise<number> {
  const searchTerms = getSearchTerms(companyName)
  let total = 0
  const seenTitles = new Set<string>()

  for (const term of searchTerms) {
    const q = encodeURIComponent(`"${term}"`)
    const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) })
      if (!res.ok) continue
      const items = parseRSSItems(await res.text())
        .filter(i => passesQualityFilter(i.title, i.description ?? '', companyName))
        .filter(i => !seenTitles.has(i.title))
        .slice(0, term === companyName ? 6 : 3) // fewer for aliases to avoid noise
      items.forEach(i => seenTitles.add(i.title))
      total += await pushSignals(companyId, companyName, items)
    } catch { /* continue to next term */ }
  }
  return total
}

async function scanHackerNews(companyId: string, companyName: string): Promise<number> {
  const since = Math.floor((Date.now() - SEVEN_DAYS_MS) / 1000)
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(companyName)}&tags=story&hitsPerPage=5&numericFilters=created_at_i>${since}`
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) })
  if (!res.ok) return 0
  const json = await res.json() as { hits: Array<{ title: string; url?: string; story_text?: string; objectID: string }> }
  const items = (json.hits ?? [])
    .filter(h => passesQualityFilter(h.title, h.story_text ?? '', companyName))
    .map(h => ({ title: h.title, link: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`, description: h.story_text?.slice(0, 300) ?? '', pubDate: undefined as string | undefined }))
  return pushSignals(companyId, companyName, items)
}

async function scanRSS(companyId: string, companyName: string, rssUrl: string): Promise<number> {
  const res = await fetch(rssUrl, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) })
  if (!res.ok) return 0
  const items = parseRSSItems(await res.text())
    .filter(i => !i.pubDate || new Date(i.pubDate).getTime() > Date.now() - SEVEN_DAYS_MS)
    .filter(i => passesQualityFilter(i.title, i.description ?? '', companyName))
    .slice(0, 5)
  return pushSignals(companyId, companyName, items)
}

// ── Quality filter — drop noise before it hits the DB ─────────────────────

function passesQualityFilter(title: string, body: string, companyName: string): boolean {
  const t = title.toLowerCase(); const b = body.toLowerCase()

  // Must mention the exact company name with word boundaries (prevents "Toast" matching "Toaster")
  // Use each word of the company name for multi-word names (e.g. "Open AI" -> checks "open" AND "ai")
  const nameParts = companyName.toLowerCase().split(/\s+/).filter(p => p.length >= 3)
  const primarySlug = nameParts[0] ?? companyName.toLowerCase()
  const nameRegex = new RegExp(`\\b${primarySlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  if (!nameRegex.test(title)) return false

  // Skip short/useless titles
  if (title.trim().length < 20) return false

  // Skip articles clearly in the wrong domain for this company
  // e.g. "Linear" matching camera/photography articles about linear zoom/AF
  const wrongDomain = [
    { company: 'linear', patterns: /\bcamera\b|\blens\b|\bmm\b.*\bf\d|\baperture\b|\bphotograph|\bimaging\b|\bsensor\b|\bfujifilm|canon|nikon|sony.*lens/i },
    { company: 'anthropic', patterns: /\btoaster\b|\bappliance\b|\bcoffee\b/i },
    { company: 'notion', patterns: /\bchemical notion\b|\blegal notion\b/i },
    { company: 'replicate', patterns: /\bfootball\b|\bsoccer\b|\bpremier.?league\b|\bnfl\b|\bnba\b|\bmanager\b.*\bclub\b|\bsports?\b|\bgoal\b|\bmatch\b|\bfan\b|\bstadium\b|\bcoach\b|\bplayer\b|\bteam\b.*\bscore/i },
    { company: 'modal', patterns: /\boscillat|\bfrequency\b|\bwaveform\b|\bseismic\b|\batmospher|\bgeolog|\bclimate\b|\bweather\b|\bnoaa\b|\bnasa\b/i },
    { company: 'pinecone', patterns: /\btree\b|\bforest\b|\bnature\b|\bwildlife\b|\bbotany\b|\bplant\b|\bpine\b.*\bneedle/i },
  ]
  for (const { company: co, patterns } of wrongDomain) {
    if (primarySlug === co && patterns.test(t)) return false
  }

  // Skip known noise patterns
  const noise = [
    /scam|fraud|fake|phish|ponzi|pyramid/,
    /price prediction|will reach \$|target price|analyst rating/,
    /how to buy|where to buy|best crypto/,
    /\bvsco?\b|\binstagram\b|\btiktok\b/,   // wrong company
    /opinion:|commentary:|letter to the editor/,
    /sponsored|advertis|promotion|press release: (?!.*(?:raise|fund|hire|launch|appoint))/i,
    /we added .* to a |gone too far|you won't believe|vibe cod/i,   // satirical clickbait
    /stock (?:alert|pick|tip)|buy now|sell now|price target/i,
  ]
  if (noise.some(r => r.test(t) || r.test(b))) return false

  // Skip listicles and how-to articles with no news value
  if (/^(top \d+|best \d+|\d+ ways|how to|guide to|what is )/i.test(title)) return false

  // Skip law firm docket listings and procedural legal notices
  // These are case citation records, not news about the company
  if (/^in re\s+/i.test(title)) return false                          // "In Re OpenAI Inc., ..."
  if (/\bllp\b|\blaw offices?\b|\bpc\b.*esq/i.test(title)) return false   // law firm name in headline
  if (/\blitigation[^$]*[-–]\s*\w+\s+\bllp\b/i.test(title)) return false // "Litigation - Firm LLP" format
  if (/\bcase no\b|\bdocket no\b|\bcivil action no\b/i.test(title)) return false
  if (/\bclass action notice\b|\bjoin the class\b|\bsettlement claim\b|\bclaim deadline\b/i.test(title)) return false
  if (/\bpursuant to\b.*\bact\b|\brule \d+[a-z]\b/i.test(title)) return false  // securities law boilerplate
  if (/complaint(?! (?:about|that|is|from))|plaintiff|defendant|deposition|injunction|subpoena/i.test(t) &&
      !/wins?|loses?|settles?|rules?|orders?|fines?|\$[\d]+/i.test(t)) return false  // procedural filings with no outcome

  // Skip if title is clearly about a different entity (contains the name only as part of a larger word)
  // e.g. "LinearB" shouldn't match "Linear", "Toaster" shouldn't match "Toast"
  const fullMatch = title.match(nameRegex)
  if (fullMatch && title.toLowerCase().replace(nameRegex, '').trim().length === 0) {
    // Title is literally just the company name, not an article
    return false
  }

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
      .from('signals').select('id')
      .eq('company_id', companyId).eq('title', item.title.trim())
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

// ── RSS helpers ────────────────────────────────────────────────────────────

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
  return stripHTML(decodeHTMLEntities(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()))
}

function stripHTML(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeHTMLEntities(s: string): string {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .trim()
}

// ── Classification ─────────────────────────────────────────────────────────

export function classifyContent(title: string, body: string): SignalType {
  const t = (title + ' ' + body).toLowerCase()
  if (/scam|fraud|fake|phish|unauthorized/.test(t)) return 'GENERAL'
  if (/\$[\d,]+ ?(?:m(?:illion)?|b(?:illion)?)|series [a-e] round|raised \$|lead investor|funding round|venture capital|seed round/.test(t)) return 'FUNDING'
  if (/layoff|laid off|reduction in force|workforce reduction|downsiz|job cuts|employees? let go/.test(t)) return 'LAYOFF'
  if (/\bhired?\b|joins as|appoints?|new (?:cto|ceo|coo|cpo|vp|svp|evp|president|head of)|chief [a-z]+ officer/.test(t)) return 'KEY_HIRE'
  if (/\blaunch(?:ed|es)?\b|announc(?:ed|es|ing)|new (?:feature|product|tool|service)|generally available|\bga\b|releases?|ships?|debut/.test(t)) return 'PRODUCT_LAUNCH'
  return 'GENERAL'
}
