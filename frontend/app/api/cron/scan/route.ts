import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { analyzeSignal } from '@/lib/claude'

// Called by GitHub Actions nightly — secured by CRON_SECRET
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Fetch all companies with their config
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, website, github_org, blog_rss_url')

  if (error || !companies) {
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }

  const results: Array<{ company: string; signals: number; errors: string[] }> = []

  for (const company of companies) {
    const companyResult = { company: company.name, signals: 0, errors: [] as string[] }

    try {
      // Scan RSS/blog feed
      if (company.blog_rss_url) {
        const rssSignals = await scanRSSFeed(company.id, company.name, company.blog_rss_url)
        companyResult.signals += rssSignals
      }

      // Scan news
      const newsSignals = await scanNews(company.id, company.name, company.website)
      companyResult.signals += newsSignals

    } catch (err) {
      companyResult.errors.push(String(err))
    }

    results.push(companyResult)
  }

  return NextResponse.json({
    scanned: companies.length,
    results,
    timestamp: new Date().toISOString(),
  })
}

async function scanRSSFeed(companyId: string, companyName: string, rssUrl: string): Promise<number> {
  const supabase = createServiceClient()
  let count = 0

  try {
    const res = await fetch(rssUrl, { headers: { 'User-Agent': 'Molocule/1.0' } })
    if (!res.ok) return 0

    const xml = await res.text()
    const items = parseRSSItems(xml).slice(0, 5)

    for (const item of items) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      if (item.pubDate && new Date(item.pubDate) < sevenDaysAgo) continue

      const type = classifyContent(item.title, item.description ?? '')
      const insight = await analyzeSignal({
        companyName,
        signalType: type,
        title: item.title,
        summary: item.description ?? '',
      })

      const { error } = await supabase.from('signals').insert({
        company_id: companyId,
        type,
        title: item.title,
        url: item.link,
        summary: item.description?.slice(0, 500),
        llm_insight: insight,
        is_new: true,
      })

      if (!error) count++
    }
  } catch {
    // RSS parse failure — non-fatal
  }

  return count
}

async function scanNews(companyId: string, companyName: string, website: string): Promise<number> {
  // In production, integrate NewsAPI or similar here.
  // For now, stub returns 0 to avoid blocking the cron.
  return 0
}

function parseRSSItems(xml: string) {
  const items: Array<{ title: string; link: string; description?: string; pubDate?: string }> = []
  const itemMatches = Array.from(xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi))

  for (const match of itemMatches) {
    const content = match[1]
    const title = extractTag(content, 'title')
    const link = extractTag(content, 'link')
    if (!title || !link) continue
    items.push({
      title: stripCDATA(title),
      link: stripCDATA(link),
      description: stripCDATA(extractTag(content, 'description') ?? ''),
      pubDate: extractTag(content, 'pubDate') ?? undefined,
    })
  }

  return items
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match?.[1]?.trim() ?? null
}

function stripCDATA(str: string): string {
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

function classifyContent(title: string, body: string): import('@/lib/types').SignalType {
  const text = (title + ' ' + body).toLowerCase()
  if (/\$[\d]+ ?m|series [a-d]|raised|funding|investment|vc|venture/.test(text)) return 'FUNDING'
  if (/layoff|laid off|reduction|workforce|downsiz/.test(text)) return 'LAYOFF'
  if (/hired|joins as|appoints|new cto|new ceo|new vp|head of/.test(text)) return 'KEY_HIRE'
  if (/launch|announce|release|ship|new product|general availability/.test(text)) return 'PRODUCT_LAUNCH'
  return 'GENERAL'
}
