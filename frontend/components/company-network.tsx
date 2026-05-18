'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Company, Signal } from '@/lib/types'
import { getFaviconUrl } from '@/lib/utils'

interface Node { id: string; name: string; x: number; y: number; vx: number; vy: number; favicon: string; radius: number; isDragging: boolean }

type EdgeKind = 'COMPETITIVE' | 'TALENT_FLOW' | 'MARKET_PRESSURE' | 'SIGNAL_MENTION' | 'INDUSTRY_PEER'

interface Edge {
  source: string; target: string
  strength: number
  kind: EdgeKind
  reason: string        // short label shown on edge
  detail: string        // longer explanation shown in panel
  color: string
}

interface InfoPanel { type: 'node' | 'edge'; title: string; subtitle: string; detail: string }

const EDGE_COLORS: Record<EdgeKind, string> = {
  COMPETITIVE:     'rgba(248,113,113,0.7)',
  TALENT_FLOW:     'rgba(251,191,36,0.7)',
  MARKET_PRESSURE: 'rgba(74,222,128,0.65)',
  SIGNAL_MENTION:  'rgba(255,255,255,0.75)',
  INDUSTRY_PEER:   'rgba(255,255,255,0.35)',
}

const EDGE_LABELS: Record<EdgeKind, string> = {
  COMPETITIVE:     'Direct rivals',
  TALENT_FLOW:     'Talent flow',
  MARKET_PRESSURE: 'Market pressure',
  SIGNAL_MENTION:  'News cross-ref',
  INDUSTRY_PEER:   'Same sector',
}

// ── Industry detection ─────────────────────────────────────────────────────
const INDUSTRIES: Record<string, string[]> = {
  fintech:   ['stripe', 'brex', 'plaid', 'mercury', 'ramp', 'affirm', 'payment', 'finance', 'fintech'],
  devtools:  ['vercel', 'linear', 'github', 'gitlab', 'render', 'railway', 'supabase', 'developer', 'deploy'],
  ai:        ['anthropic', 'openai', 'cohere', 'mistral', 'perplexity', 'claude', 'gpt', 'llm', 'artificial'],
  saas:      ['notion', 'figma', 'canva', 'airtable', 'monday', 'asana', 'productiv'],
  hr:        ['rippling', 'gusto', 'deel', 'remote', 'lattice', 'workday', 'payroll', 'hr tech'],
}

function detectIndustry(company: Company): string {
  const text = (company.name + ' ' + (company.website ?? '') + ' ' + (company.github_org ?? '')).toLowerCase()
  for (const [industry, keywords] of Object.entries(INDUSTRIES)) {
    if (keywords.some(k => text.includes(k))) return industry
  }
  return 'other'
}

// ── Competitive pairs (hardcoded known rivalries) ─────────────────────────
const RIVALRIES: [string, string][] = [
  ['Stripe', 'Brex'], ['Stripe', 'Square'], ['Stripe', 'PayPal'],
  ['Anthropic', 'OpenAI'], ['Anthropic', 'Cohere'],
  ['Vercel', 'Netlify'], ['Vercel', 'Cloudflare'],
  ['Linear', 'Jira'], ['Linear', 'Notion'], ['Notion', 'Confluence'],
  ['Figma', 'Sketch'], ['Figma', 'Adobe'],
  ['Rippling', 'Gusto'], ['Rippling', 'Workday'],
  ['Brex', 'Ramp'],
]

function areRivals(a: Company, b: Company): boolean {
  return RIVALRIES.some(([x, y]) =>
    (a.name.toLowerCase().includes(x.toLowerCase()) && b.name.toLowerCase().includes(y.toLowerCase())) ||
    (a.name.toLowerCase().includes(y.toLowerCase()) && b.name.toLowerCase().includes(x.toLowerCase()))
  )
}

// ── Cross-mention detection ────────────────────────────────────────────────
function signalsMentionEachOther(sigsA: Signal[], companyB: Company, sigsB: Signal[], companyA: Company): { title: string; signal: Signal } | null {
  for (const s of sigsA) {
    const text = (s.title + ' ' + (s.summary ?? '')).toLowerCase()
    if (text.includes(companyB.name.toLowerCase())) return { title: s.title, signal: s }
  }
  for (const s of sigsB) {
    const text = (s.title + ' ' + (s.summary ?? '')).toLowerCase()
    if (text.includes(companyA.name.toLowerCase())) return { title: s.title, signal: s }
  }
  return null
}

// Truncate at the last word boundary before max chars to avoid cutting mid-word
function wordTrunc(s: string, max: number): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
}

// ── Build unique signal-mention detail based on actual mention content ─────
function buildSignalMentionDetail(nameA: string, nameB: string, mentionTitle: string, signal: Signal): string {
  const m = (mentionTitle + ' ' + (signal.summary ?? '')).toLowerCase()
  const insight = signal.llm_insight ? `Context on this signal: ${signal.llm_insight}` : null

  // Lead with the actual news, then one sharp inference specific to these companies
  const summary = signal.summary ? ` ${wordTrunc(signal.summary, 120)}` : ''

  if (/exploit|vulnerabil|hack|breach|malware|attack|patch|cve|zero.?day|security|flaw/.test(m)) {
    const call = insight ?? `${nameA}'s technology and ${nameB}'s hardware were named in the same security incident, meaning AI-assisted vulnerability discovery is already reaching the hardware layer. The next disclosure from either company will reveal how seriously each is treating this as a structural threat versus a one-off.`
    return `${mentionTitle}.${summary} ${call}`
  }
  if (/chip|semiconductor|silicon|manufactur|supply.?chain|foundry|wafer|fab/.test(m)) {
    const call = insight ?? `${nameA} and ${nameB} appearing in the same supply chain story means a hardware dependency is already being evaluated at the engineering level. Formal contract or design-win announcements typically follow this kind of coverage by 12 to 18 months.`
    return `${mentionTitle}.${summary} ${call}`
  }
  if (/acqui|merger|deal|takeover|buyout|acquire/.test(m)) {
    const call = insight ?? `This M&A-adjacent mention of ${nameA} and ${nameB} means someone is already modeling a transaction. Watch for board changes, new financial advisors, or executives going quiet on public appearances over the next 60 days.`
    return `${mentionTitle}.${summary} ${call}`
  }
  if (/partner|collaborat|integrat|alliance|joint/.test(m)) {
    const call = insight ?? `${nameA} and ${nameB} being tied together in a partnership story means both teams see commercial value in the association. If executive alignment exists, a formal go-to-market or integration announcement typically follows within 60 to 90 days.`
    return `${mentionTitle}.${summary} ${call}`
  }
  if (/regulat|antitrust|ftc|doj|investig|fine|sanction|scrutin/.test(m)) {
    const call = insight ?? `${nameA} and ${nameB} named together in regulatory coverage means a regulator or reporter is treating them as part of the same market concentration question. The company with fewer legal resources will lose more roadmap velocity to compliance work.`
    return `${mentionTitle}.${summary} ${call}`
  }
  if (/fund|invest|valuat|round|capital|series|raise/.test(m)) {
    const call = insight ?? `${nameA} and ${nameB} appearing in the same capital markets story means investors are benchmarking them as alternatives in the same sector thesis. Whichever closes its round first uses that credibility to accelerate enterprise deals before the other can respond.`
    return `${mentionTitle}.${summary} ${call}`
  }
  if (/compet|rival|vs\.|versus|market.?share/.test(m)) {
    const call = insight ?? `This story pitting ${nameA} against ${nameB} will sharpen customer evaluation cycles at both companies immediately. Expect a pricing change, case study, or product announcement from one of them within 30 to 45 days as a direct response.`
    return `${mentionTitle}.${summary} ${call}`
  }
  if (/hire|appoint|join|exec|ceo|cto|vp|chief|head.?of/.test(m)) {
    const call = insight ?? `This executive move names both ${nameA} and ${nameB} in the same headline, revealing which direction competitive talent is flowing. The function of the role predicts exactly which capability the receiving company is about to build.`
    return `${mentionTitle}.${summary} ${call}`
  }
  const call = insight ?? `${nameA} and ${nameB} named in the same story is the earliest signal the market is starting to evaluate them together. A second co-mention from a different source within 30 days confirms this is structural, not incidental.`
  return `${mentionTitle}.${summary} ${call}`
}

// ── Build unique COMPETITIVE detail, uses actual signals for non-hardcoded pairs
function buildCompetitiveDetail(nameA: string, nameB: string, sigsA: Signal[], sigsB: Signal[], industry: string): string {
  const key = [nameA, nameB].map(n => n.toLowerCase()).sort().join('|')

  const rivalryMap: Record<string, string> = {
    'anthropic|openai': `Anthropic and OpenAI are racing to own the enterprise AI model layer, competing for the same API contracts, safety credibility, and frontier research talent. Both have built their entire positioning around trustworthy AI, which means a reputational event at either company directly affects buyer confidence in the other. Every model release, benchmark result, or safety incident from one sets the reference point customers use to evaluate the other.`,
    'brex|ramp': `Brex and Ramp are the two dominant challengers in the corporate card and spend management space, both targeting the same fast-growing startup and SMB customer. Their feature sets have converged almost entirely, which means sales cycles are now won on pricing, integrations, and relationship rather than product differentiation. Watch expense policy changes, bank partnership announcements, and sales headcount additions as the signals that predict which team is pressing harder.`,
    'brex|stripe': `Stripe and Brex started in different layers of the financial stack but are converging on the same B2B customer. Stripe's push into corporate cards and Brex's expansion into API banking products means every new enterprise deal is increasingly contested between them. Product announcements and partnership agreements from either company are direct signals of where the next overlap will emerge.`,
    'openai|perplexity': `OpenAI and Perplexity are competing to become the default AI search and answer layer for consumers and knowledge workers. Perplexity's growth threatens the same user session time that OpenAI's ChatGPT depends on for consumer revenue. Any feature that blurs the line between search and generation from either team reshapes the other's go-to-market positioning overnight.`,
    'anthropic|cohere': `Anthropic and Cohere are both selling enterprise-grade LLM infrastructure but with different risk profiles. Anthropic leads on safety narrative while Cohere leads on data privacy and on-premise deployment. Enterprise RFPs increasingly require evaluation of both, which means every model capability update or pricing change from one is a signal the other's sales team is already briefing customers on.`,
    'vercel|cloudflare': `Vercel and Cloudflare are converging on the same edge compute and frontend deployment market from opposite directions. Vercel owns the developer experience layer while Cloudflare owns the network. As both add capabilities in the other's core territory, customer lock-in is becoming the primary competitive weapon, and pricing moves from either side will accelerate consolidation.`,
    'vercel|netlify': `Vercel and Netlify were the two defining platforms of the Jamstack era and remain the primary reference points for enterprise frontend deployment decisions. Vercel has pulled ahead on Next.js adoption and enterprise sales, but Netlify's framework-agnostic positioning and build tooling keep it relevant for teams not on Next.js. Pricing changes, enterprise tier additions, and framework partnership announcements from either are direct signals of where the next sales contest will happen.`,
    'figma|adobe': `Adobe acquired Figma and then walked away from the deal under regulatory pressure, leaving both companies in direct competition with significant context about each other's roadmaps. Adobe is rebuilding its design tooling as a direct response to Figma's dominance, and Figma is expanding into presentation and whiteboarding to reduce Adobe's surface area for attack. Every product announcement from either company should be read as a deliberate move in a market where both teams already know the other's playbook.`,
    'figma|sketch': `Figma made Sketch's desktop-only model obsolete, forcing Sketch into a web offering and subscription pivot that has not fully closed the gap. The two products still share a significant population of designers who evaluate both for new team rollouts. Figma's enterprise expansion is the primary pressure Sketch must respond to, and any new Sketch feature that matches Figma's collaboration capabilities is a direct signal that the gap is narrowing.`,
    'rippling|gusto': `Rippling and Gusto are competing to own the HR and payroll stack for SMBs and mid-market companies, but from opposite strategic angles. Gusto leads on simplicity and bookkeeper partnerships while Rippling leads on system integration and automation depth. As both companies move upmarket the overlap is increasing, and every new integration or vertical add-on from either team is a direct competitive move against the other's account base.`,
    'rippling|workday': `Rippling is the most credible challenger to Workday's position in the HR and workforce management platform market, specifically targeting the segment Workday has historically underserved with its complexity and cost. Rippling's modular pricing and automation-first architecture appeals to companies that have outgrown Gusto but do not want Workday's overhead. Every enterprise feature Rippling ships is a signal it is moving up into Workday's core customer bracket.`,
    'linear|notion': `Linear and Notion are the two most-discussed tools in the product and engineering workflow space, each capturing a different end of the spectrum. Linear wins on opinionated engineering workflow while Notion wins on flexibility and documentation. As Linear adds docs and Notion adds structured project tracking, every feature release in the other's core domain is a signal of strategic convergence worth tracking closely.`,
    'stripe|paypal': `Stripe and PayPal represent the new and old guard of internet payments infrastructure, competing for the same merchant and developer accounts from fundamentally different brand positions. PayPal's consumer brand is a liability with developers while Stripe's enterprise pricing is a liability with SMBs. Checkout conversion rate studies, enterprise contract wins, and API pricing changes are the most direct signals of competitive pressure between them.`,
    'stripe|square': `Stripe and Square started on opposite sides of the payments world and have been growing toward each other for years. Square's developer tools and Stripe's point-of-sale push have created a genuine overlap zone for businesses that operate both online and in-person. Every new integration from either company in the other's core channel is a signal that the contested middle ground is widening.`,
  }

  if (rivalryMap[key]) return rivalryMap[key]

  // Not in the hardcoded map: build from actual signal data so it is specific to these companies
  const typeVerb: Record<string, string> = {
    FUNDING: 'raised capital', KEY_HIRE: 'made a key hire',
    LAYOFF: 'announced a layoff', PRODUCT_LAUNCH: 'shipped a new product', GENERAL: 'had a notable development',
  }
  const latestA = sigsA[0]; const latestB = sigsB[0]
  if (latestA && latestB) {
    const verbA = typeVerb[latestA.type] ?? 'had a development'
    const verbB = typeVerb[latestB.type] ?? 'had a development'
    const insight = latestA.llm_insight ?? latestB.llm_insight
    const line3 = insight
      ? `Signal context: ${insight}`
      : `Moves at one company in the ${industry} space tend to create response pressure at the other within 60 to 90 days. Track both together as a pair rather than separately.`
    return `${nameA} and ${nameB} compete directly in the ${industry} space. Most recently, ${nameA} ${verbA} ("${wordTrunc(latestA.title, 60)}") while ${nameB} ${verbB} ("${wordTrunc(latestB.title, 60)}"). ${line3}`
  }
  return `${nameA} and ${nameB} compete in the ${industry} space for the same customers and budget. Scan both companies regularly and compare their signals side by side, the gap between their recent moves will tell you which team is on offense and which is responding.`
}

// ── Build unique INDUSTRY_PEER detail from actual matched signal titles ────
function buildIndustryPeerDetail(nameA: string, nameB: string, sigsA: Signal[], sigsB: Signal[], industryA: string, sharedType: string): string {
  const matchA = sigsA.find(s => s.type === sharedType)
  const matchB = sigsB.find(s => s.type === sharedType)

  if (sharedType === 'FUNDING') {
    const amtA = matchA?.title?.match(/\$[\d,.]+\s*[BMbm](?:illion)?/)?.[0]
    const amtB = matchB?.title?.match(/\$[\d,.]+\s*[BMbm](?:illion)?/)?.[0]
    const line1 = amtA && amtB
      ? `${nameA} (${amtA}) and ${nameB} (${amtB}) both raised capital in the ${industryA} space during the same period, signaling investor conviction in the category rather than a bet on a single winner.`
      : matchA && matchB
      ? `${nameA} and ${nameB} both raised capital in the ${industryA} space in the same window: "${wordTrunc(matchA.title, 60)}" and "${wordTrunc(matchB.title, 60)}".`
      : `${nameA} and ${nameB} both raised capital in the ${industryA} space in the same window.`
    return `${line1} The deployment race starts now: watch both companies' LinkedIn job boards for VP Sales, Senior Account Executive, and Solutions Engineer postings in the next 90 days. The team that converts capital into quota-carrying sales headcount first typically locks enterprise deals before the other can mount a competing motion.`
  }

  if (sharedType === 'KEY_HIRE') {
    const line1 = matchA && matchB
      ? `${nameA} and ${nameB} both made senior hires in the ${industryA} space in the same window: "${wordTrunc(matchA.title, 60)}" and "${wordTrunc(matchB.title, 60)}".`
      : `${nameA} and ${nameB} both made senior hires in the ${industryA} space during the same period.`
    return `${line1} The functions each company is hiring into reveal their strategic bets: commercial hires (CRO, VP Sales, AE) signal an aggressive go-to-market push, while product and engineering hires signal a platform investment before the next sales cycle. If ${nameA} and ${nameB} are hiring into different functions, they are betting on different paths to the same market, which will clarify which approach wins within 12 months.`
  }

  if (sharedType === 'LAYOFF') {
    const line1 = matchA && matchB
      ? `${nameA} and ${nameB} both reduced headcount in the ${industryA} space during the same period: "${wordTrunc(matchA.title, 60)}" and "${wordTrunc(matchB.title, 60)}".`
      : `${nameA} and ${nameB} both reduced headcount in the ${industryA} space during the same period.`
    return `${line1} The most diagnostic signal is where each company made the cuts: layoffs hitting sales and recruiting are operational efficiency moves, while cuts to engineering and product are strategic retreats. Whichever company protected its core product team will recover roadmap velocity fastest and is the better bet to absorb the customers left uncertain by both restructurings.`
  }

  if (sharedType === 'PRODUCT_LAUNCH') {
    const line1 = matchA && matchB
      ? `${nameA} and ${nameB} both shipped new products or features in the ${industryA} space in the same window: "${wordTrunc(matchA.title, 60)}" and "${wordTrunc(matchB.title, 60)}".`
      : `${nameA} and ${nameB} both launched new products in the ${industryA} space during the same period.`
    return `${line1} Simultaneous launches in the same sector almost always trace back to the same enterprise RFP conversations surfacing an identical gap. The company that lands the first referenceable logo for its launch becomes the default in that category for the next sales cycle. Track customer announcements and case studies from both teams in the next 60 days to see which one is winning the reference race.`
  }

  return `Both ${nameA} and ${nameB} had notable activity in the ${industryA} sector during the same period. The most productive way to use this connection: any time a signal fires at one company, treat it as a 30-day early warning that the other will face pressure to respond in the same direction. Do not analyze either company in isolation when they are active in the same sector at the same time.`
}

// ── Build talent flow detail with role-specific prediction ────────────────
function buildTalentFlowDetail(nameA: string, nameB: string, signalTitle: string): string {
  const t = signalTitle.toLowerCase()
  let prediction: string

  if (/\bcro\b|chief revenue|sales/.test(t)) {
    prediction = `A CRO crossing between these companies signals ${nameA} is professionalizing its enterprise sales motion. Expect structured territory plans, enterprise packaging changes, and longer average contract values to emerge within the next two quarters.`
  } else if (/\bcoo\b|chief operating|operations/.test(t)) {
    prediction = `An operations executive moving between ${nameA} and ${nameB} signals one of them is preparing for scaled growth or IPO-readiness. Watch for process standardization, headcount structure changes, and new geographic expansion announcements within 6 months.`
  } else if (/\bcto\b|chief technology|engineering/.test(t)) {
    prediction = `A technical executive crossing between ${nameA} and ${nameB} often precedes a platform or architecture shift at the destination company. Expect a major product or infrastructure announcement within 12 months that reflects the incoming CTO's prior technical bets.`
  } else if (/\bcpo\b|chief product|product/.test(t)) {
    prediction = `A product leader moving between ${nameA} and ${nameB} typically reshapes the destination company's roadmap toward the market the executive knows best. The first 90-day product decision will signal which customer segment is now the primary priority.`
  } else if (/\bcfo\b|chief financial|finance/.test(t)) {
    prediction = `A CFO hire from this background signals the destination company is entering a capital discipline phase, whether that means IPO preparation, profitability targets, or tighter unit economics requirements on sales. Procurement cycles at that company will likely tighten within two quarters.`
  } else if (/vp|vice president|head of/.test(t)) {
    prediction = `A VP-level move between ${nameA} and ${nameB} at this seniority indicates deliberate capability acquisition rather than passive recruitment. The function being hired predicts exactly which gap the company is closing. Watch the destination company's next job postings in the same function as the clearest confirmation of intent.`
  } else {
    prediction = `Senior talent moving explicitly between ${nameA} and ${nameB} signals one team identified a specific capability gap and moved to close it. The first major announcement in that person's domain within 6 months will confirm whether the bet was correct.`
  }

  return `A hire signal names both ${nameA} and ${nameB} in the same story: "${signalTitle}". ${prediction}`
}

// ── Talent flow detection ──────────────────────────────────────────────────
function detectTalentFlow(sigsA: Signal[], nameB: string, sigsB: Signal[], nameA: string): string | null {
  const hireRegex = /\b(hired?|joins?|appoints?|named|poached?|from)\b/i
  for (const s of [...sigsA, ...sigsB]) {
    if (s.type !== 'KEY_HIRE') continue
    const text = s.title + ' ' + (s.summary ?? '')
    const tl = text.toLowerCase()
    // Both companies MUST appear in the same signal to form a valid connection
    if (hireRegex.test(text) && tl.includes(nameA.toLowerCase()) && tl.includes(nameB.toLowerCase())) {
      return wordTrunc(s.title, 80)
    }
  }
  return null
}

// ── Market pressure ────────────────────────────────────────────────────────
function detectMarketPressure(sigsA: Signal[], companyA: Company, sigsB: Signal[], companyB: Company): string | null {
  const fundingA = sigsA.find(s => s.type === 'FUNDING')
  const fundingB = sigsB.find(s => s.type === 'FUNDING')
  const layoffA  = sigsA.find(s => s.type === 'LAYOFF')
  const layoffB  = sigsB.find(s => s.type === 'LAYOFF')
  const launchA  = sigsA.find(s => s.type === 'PRODUCT_LAUNCH')
  const launchB  = sigsB.find(s => s.type === 'PRODUCT_LAUNCH')

  if (fundingA && layoffB) return `${companyA.name} secured new capital while ${companyB.name} reduced headcount in the same period. This divergence is one of the strongest leading indicators of a market share shift: the funded company accelerates into exactly the customer segments the contracting one can no longer serve. Expect ${companyA.name} to announce expanded enterprise coverage or a new product tier within the next 60 days targeting ${companyB.name}'s existing base.`
  if (fundingB && layoffA) return `${companyB.name} secured new capital while ${companyA.name} reduced headcount in the same period. This divergence is one of the strongest leading indicators of a market share shift: the funded company accelerates into exactly the customer segments the contracting one can no longer serve. Expect ${companyB.name} to announce expanded coverage or a new product tier within the next 60 days targeting ${companyA.name}'s existing base.`
  if (launchA && launchB) return `Both ${companyA.name} and ${companyB.name} launched new products or features in the same period, confirming a direct feature race in this segment. When two competitors ship in the same window, the market resolves on distribution speed rather than product quality. Predict that whichever company lands the first major enterprise logo referencing the new feature will set the benchmark both sales teams cite for the next 12 months.`
  if (fundingA && fundingB) return `Both ${companyA.name} and ${companyB.name} raised capital in the same cycle, signaling that investors are positioning ahead of a sector-wide inflection rather than backing a single winner. When parallel fundraises close, the deployment race begins: the company that converts capital into headcount and product faster will capture the market share that the next 18 months will distribute. Watch first job postings from both teams as the clearest signal of where each is placing its first bet.`
  return null
}

// ── Main edge computation ──────────────────────────────────────────────────
// Exported so focused network pages can determine real graph connections
// without duplicating the edge-computation logic.
export function getConnectedIds(focalId: string, companies: Company[], signals: Signal[]): Set<string> {
  const edges = computeEdges(companies, signals)
  const ids = new Set<string>()
  for (const e of edges) {
    if (e.source === focalId) ids.add(e.target)
    if (e.target === focalId) ids.add(e.source)
  }
  return ids
}

function computeEdges(companies: Company[], signals: Signal[]): Edge[] {
  const edges: Edge[] = []
  const sigsByCompany = new Map<string, Signal[]>()
  for (const s of signals) {
    if (!sigsByCompany.has(s.company_id)) sigsByCompany.set(s.company_id, [])
    sigsByCompany.get(s.company_id)!.push(s)
  }

  const industryMap = new Map(companies.map(c => [c.id, detectIndustry(c)]))

  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      const a = companies[i]; const b = companies[j]
      const sigsA = sigsByCompany.get(a.id) ?? []
      const sigsB = sigsByCompany.get(b.id) ?? []
      const industryA = industryMap.get(a.id); const industryB = industryMap.get(b.id)

      // 1. Direct rivalry (strongest signal)
      if (areRivals(a, b)) {
        const pressureReason = detectMarketPressure(sigsA, a, sigsB, b)
        edges.push({
          source: a.id, target: b.id, strength: 0.9,
          kind: pressureReason ? 'MARKET_PRESSURE' : 'COMPETITIVE',
          reason: pressureReason ? 'Market pressure' : 'Direct rivals',
          detail: pressureReason ?? buildCompetitiveDetail(a.name, b.name, sigsA, sigsB, industryA ?? 'tech'),
          color: pressureReason ? EDGE_COLORS.MARKET_PRESSURE : EDGE_COLORS.COMPETITIVE,
        })
        continue
      }

      // 2. Cross-mention in signals
      const mention = signalsMentionEachOther(sigsA, b, sigsB, a)
      if (mention) {
        edges.push({
          source: a.id, target: b.id, strength: 0.85,
          kind: 'SIGNAL_MENTION',
          reason: 'News cross-ref',
          detail: buildSignalMentionDetail(a.name, b.name, mention.title, mention.signal),
          color: EDGE_COLORS.SIGNAL_MENTION,
        })
        continue
      }

      // 3. Talent flow between companies
      const talent = detectTalentFlow(sigsA, b.name, sigsB, a.name)
      if (talent) {
        edges.push({
          source: a.id, target: b.id, strength: 0.75,
          kind: 'TALENT_FLOW',
          reason: 'Talent flow',
          detail: buildTalentFlowDetail(a.name, b.name, talent),
          color: EDGE_COLORS.TALENT_FLOW,
        })
        continue
      }

      // 4. Market pressure (same industry, different event types)
      if (industryA === industryB && industryA !== 'other') {
        const pressure = detectMarketPressure(sigsA, a, sigsB, b)
        if (pressure) {
          edges.push({
            source: a.id, target: b.id, strength: 0.7,
            kind: 'MARKET_PRESSURE',
            reason: 'Market pressure',
            detail: pressure,
            color: EDGE_COLORS.MARKET_PRESSURE,
          })
          continue
        }

        // 5. Same industry peer - only show when both share the same signal type (meaningful overlap)
        if (sigsA.length >= 2 && sigsB.length >= 2) {
          const typesA = new Set(sigsA.map(s => s.type))
          const typesB = new Set(sigsB.map(s => s.type))
          const sharedTypes = [...typesA].filter(t => typesB.has(t) && t !== 'GENERAL')
          if (sharedTypes.length > 0) {
            edges.push({
              source: a.id, target: b.id, strength: 0.3,
              kind: 'INDUSTRY_PEER',
              reason: `${industryA} sector`,
              detail: buildIndustryPeerDetail(a.name, b.name, sigsA, sigsB, industryA ?? 'tech', sharedTypes[0]),
              color: EDGE_COLORS.INDUSTRY_PEER,
            })
          }
        }
      }
    }
  }

  // Deduplicate: keep only the highest-strength edge per pair
  const edgeMap = new Map<string, Edge>()
  for (const e of edges) {
    const key = [e.source, e.target].sort().join('|')
    const existing = edgeMap.get(key)
    if (!existing || e.strength > existing.strength) edgeMap.set(key, e)
  }
  return Array.from(edgeMap.values())
}

export function CompanyNetwork({ companies, signals, enableNavigation = true }: { companies: Company[]; signals: Signal[]; enableNavigation?: boolean }) {
  const router     = useRouter()
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const nodesRef   = useRef<Node[]>([])
  const edgesRef   = useRef<Edge[]>([])
  const imagesRef  = useRef<Map<string, HTMLImageElement>>(new Map())
  const rafRef     = useRef<number>(0)
  const dragRef    = useRef<{ nodeId: string; ox: number; oy: number } | null>(null)
  const panRef     = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null)  // track actual movement
  const scaleRef   = useRef(1)
  const offsetRef  = useRef({ x: 0, y: 0 })
  const focusRef   = useRef<string | null>(null)
  const [infoPanel, setInfoPanel] = useState<InfoPanel | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const W = canvas.offsetWidth; const H = canvas.offsetHeight
    canvas.width = W; canvas.height = H
    scaleRef.current = 1; offsetRef.current = { x: 0, y: 0 }; focusRef.current = null

    nodesRef.current = companies.map((c, i) => {
      const angle = (i / companies.length) * Math.PI * 2
      const r = Math.min(W, H) * 0.28
      return { id: c.id, name: c.name, x: W/2 + r*Math.cos(angle), y: H/2 + r*Math.sin(angle), vx: 0, vy: 0, favicon: getFaviconUrl(c.website), radius: 22, isDragging: false }
    })
    edgesRef.current = computeEdges(companies, signals)

    for (const n of nodesRef.current) {
      if (imagesRef.current.has(n.favicon)) continue
      const img = new Image(); img.src = n.favicon
      img.onload = () => imagesRef.current.set(n.favicon, img)
    }
  }, [companies, signals])

  const toWorld = useCallback((cx: number, cy: number) => {
    const s = scaleRef.current; const o = offsetRef.current
    return { x: (cx - o.x) / s, y: (cy - o.y) / s }
  }, [])

  const canvasXY = useCallback((e: React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }, [])

  const nodeAt = useCallback((wx: number, wy: number) =>
    nodesRef.current.find(n => Math.hypot(n.x - wx, n.y - wy) <= n.radius + 6), [])

  const edgeAt = useCallback((wx: number, wy: number) => {
    for (const e of edgesRef.current) {
      const a = nodesRef.current.find(n => n.id === e.source)
      const b = nodesRef.current.find(n => n.id === e.target)
      if (!a || !b) continue
      const dx = b.x-a.x; const dy = b.y-a.y; const len = Math.sqrt(dx*dx+dy*dy)||1
      const t = Math.max(0, Math.min(1, ((wx-a.x)*dx+(wy-a.y)*dy)/(len*len)))
      const px = a.x+t*dx-wx; const py = a.y+t*dy-wy
      if (Math.sqrt(px*px+py*py) < 12/scaleRef.current) return e
    }
    return null
  }, [])

  const simulate = useCallback(() => {
    const nodes = nodesRef.current; const edges = edgesRef.current
    const canvas = canvasRef.current; if (!canvas) return
    const W = canvas.width; const H = canvas.height
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i+1; j < nodes.length; j++) {
        const a=nodes[i]; const b=nodes[j]; const dx=b.x-a.x; const dy=b.y-a.y
        const d=Math.sqrt(dx*dx+dy*dy)||1; const f=5500/(d*d); const fx=f*dx/d; const fy=f*dy/d
        if(!a.isDragging){a.vx-=fx;a.vy-=fy} if(!b.isDragging){b.vx+=fx;b.vy+=fy}
      }
    }
    const REST = Math.min(W,H)*0.26
    for (const e of edges) {
      const a=nodes.find(n=>n.id===e.source); const b=nodes.find(n=>n.id===e.target)
      if(!a||!b) continue
      const dx=b.x-a.x; const dy=b.y-a.y; const d=Math.sqrt(dx*dx+dy*dy)||1
      const f=(d-REST)*0.016*e.strength; const fx=f*dx/d; const fy=f*dy/d
      if(!a.isDragging){a.vx+=fx;a.vy+=fy} if(!b.isDragging){b.vx-=fx;b.vy-=fy}
    }
    for (const n of nodes) {
      n.vx+=(W/2-n.x)*0.0005; n.vy+=(H/2-n.y)*0.0005
      if(!n.isDragging){n.vx*=0.82;n.vy*=0.82;n.x+=n.vx;n.y+=n.vy}
      n.x=Math.max(n.radius+4,Math.min(W-n.radius-4,n.x))
      n.y=Math.max(n.radius+4,Math.min(H-n.radius-4,n.y))
    }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const nodes = nodesRef.current; const edges = edgesRef.current
    const s = scaleRef.current; const o = offsetRef.current; const focused = focusRef.current
    ctx.clearRect(0,0,canvas.width,canvas.height)
    ctx.save(); ctx.translate(o.x,o.y); ctx.scale(s,s)

    const dim = (id: string) => focused !== null && id !== focused &&
      !edges.some(e=>(e.source===focused&&e.target===id)||(e.target===focused&&e.source===id))

    for (const e of edges) {
      const a=nodes.find(n=>n.id===e.source); const b=nodes.find(n=>n.id===e.target)
      if(!a||!b) continue
      const isDimmed=focused&&dim(a.id)&&dim(b.id)
      const isLit=focused&&(e.source===focused||e.target===focused)
      // Competitive/market edges get higher base opacity so their colour is actually visible
      const baseOp = (e.kind==='COMPETITIVE'||e.kind==='MARKET_PRESSURE') ? 0.38+e.strength*0.15 : 0.08+e.strength*0.18
      const op=isDimmed?0.03:isLit?0.65+e.strength*0.3:baseOp
      ctx.strokeStyle=e.color.replace(/[\d.]+\)$/,`${op})`); ctx.lineWidth=isLit?1.8+e.strength:0.8+e.strength*0.6
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke()
      if(isLit&&s>0.6){
        const mx=(a.x+b.x)/2; const my=(a.y+b.y)/2
        ctx.fillStyle=e.color.replace(/[\d.]+\)$/,'0.9)')
        ctx.beginPath(); ctx.arc(mx,my,2.5/s,0,Math.PI*2); ctx.fill()
        ctx.save(); ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font=`bold ${10/s}px system-ui`
        ctx.textAlign='center'; ctx.textBaseline='bottom'
        ctx.fillText(e.reason,mx,my-5/s); ctx.restore()
      }
    }
    for (const n of nodes) {
      const isDim=dim(n.id); const isFoc=n.id===focused; const r=n.radius
      ctx.save(); ctx.globalAlpha=isDim?0.15:1
      if(isFoc){ctx.shadowColor='rgba(255,255,255,0.35)';ctx.shadowBlur=16/s}
      ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2)
      ctx.fillStyle=isFoc?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.04)'; ctx.fill()
      ctx.strokeStyle=isFoc?'rgba(255,255,255,0.45)':'rgba(255,255,255,0.18)'
      ctx.lineWidth=isFoc?1.5:0.8; ctx.stroke(); ctx.shadowBlur=0
      const img=imagesRef.current.get(n.favicon)
      if(img){ctx.save();ctx.beginPath();ctx.arc(n.x,n.y,r-4,0,Math.PI*2);ctx.clip();ctx.drawImage(img,n.x-(r-4),n.y-(r-4),(r-4)*2,(r-4)*2);ctx.restore()}
      else{ctx.fillStyle='rgba(255,255,255,0.7)';ctx.font=`bold ${r*0.55}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n.name[0],n.x,n.y)}
      ctx.fillStyle=isFoc?'rgba(255,255,255,0.88)':'rgba(255,255,255,0.55)'
      ctx.font=`${isFoc?'600 ':''} ${Math.max(8,11/s)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='top'
      ctx.fillText(n.name,n.x,n.y+r+4); ctx.restore()
    }
    ctx.restore()
  }, [])

  useEffect(() => {
    // Pre-settle physics before first frame so nodes don't visibly snap into place
    for (let i = 0; i < 120; i++) simulate()
    function loop(){simulate();draw();rafRef.current=requestAnimationFrame(loop)}
    rafRef.current=requestAnimationFrame(loop)
    return ()=>cancelAnimationFrame(rafRef.current)
  },[simulate,draw])

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const {x,y}=canvasXY(e); const factor=e.deltaY<0?1.1:0.9
    const ns=Math.max(0.3,Math.min(3,scaleRef.current*factor))
    offsetRef.current={x:x-(x-offsetRef.current.x)*(ns/scaleRef.current),y:y-(y-offsetRef.current.y)*(ns/scaleRef.current)}
    scaleRef.current=ns
  }

  function onMouseDown(e: React.MouseEvent) {
    const {x,y}=canvasXY(e); const w=toWorld(x,y); const node=nodeAt(w.x,w.y)
    mouseDownPos.current={x,y}   // record where mouse went down
    if(node){node.isDragging=true;dragRef.current={nodeId:node.id,ox:w.x-node.x,oy:w.y-node.y}}
    else panRef.current={sx:x,sy:y,ox:offsetRef.current.x,oy:offsetRef.current.y}
  }

  function onMouseMove(e: React.MouseEvent) {
    const {x,y}=canvasXY(e); const w=toWorld(x,y)
    if(dragRef.current){const n=nodesRef.current.find(n=>n.id===dragRef.current!.nodeId);if(n){n.x=w.x-dragRef.current.ox;n.y=w.y-dragRef.current.oy};canvasRef.current!.style.cursor='grabbing';return}
    if(panRef.current){offsetRef.current={x:panRef.current.ox+x-panRef.current.sx,y:panRef.current.oy+y-panRef.current.sy};canvasRef.current!.style.cursor='grabbing';return}
    const node=nodeAt(w.x,w.y); const edge=!node?edgeAt(w.x,w.y):null
    canvasRef.current!.style.cursor=node||edge?'pointer':'grab'
  }

  function onMouseUp(e: React.MouseEvent) {
    const {x,y}=canvasXY(e); const w=toWorld(x,y)
    // A "drag" only counts if the mouse moved more than 4px from where it went down
    const mdp=mouseDownPos.current
    const moved=mdp?Math.sqrt((x-mdp.x)**2+(y-mdp.y)**2)>4:false
    mouseDownPos.current=null
    if(dragRef.current){const n=nodesRef.current.find(n=>n.id===dragRef.current!.nodeId);if(n){n.isDragging=false;n.vx=0;n.vy=0};dragRef.current=null}
    panRef.current=null; canvasRef.current!.style.cursor='grab'
    if(!moved){
      const node=nodeAt(w.x,w.y); const edge=!node?edgeAt(w.x,w.y):null
      if(node){
        // Single-click: navigate to focused subgraph view
        if(enableNavigation){ router.push(`/network/${node.id}`); return }
        // Navigation disabled (on the focused page itself): show panel
        const same=focusRef.current===node.id; focusRef.current=same?null:node.id
        const connected=edgesRef.current.filter(e=>e.source===node.id||e.target===node.id)
        setInfoPanel(same?null:{
          type:'node',title:node.name,subtitle:`${connected.length} connection${connected.length!==1?'s':''}`,
          detail:connected.length>0
            ?connected.map(e=>{const other=nodesRef.current.find(n=>n.id===(e.source===node.id?e.target:e.source));return `${EDGE_LABELS[e.kind].toUpperCase()} - ${other?.name}: ${e.detail}`}).join('\n\n')
            :'No connections yet. Add more companies in the same sector or with related signals.',
        })
      } else if(edge){
        const a=nodesRef.current.find(n=>n.id===edge.source); const b=nodesRef.current.find(n=>n.id===edge.target)
        setInfoPanel({type:'edge',title:`${a?.name} + ${b?.name}`,subtitle:EDGE_LABELS[edge.kind],detail:edge.detail})
      } else { focusRef.current=null; setInfoPanel(null) }
    }
  }

  if(companies.length===0) return null

  const edgeCounts = Object.fromEntries(Object.keys(EDGE_LABELS).map(k=>[k,edgesRef.current.filter(e=>e.kind===k).length]))

  return (
    <div className="relative w-full" style={{height:520}}>
      <canvas ref={canvasRef} className="w-full h-full" style={{cursor:'grab',display:'block'}}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onMouseLeave={() => {
          // Only release drag/pan, never dismiss the info panel on mouse leave
          if(dragRef.current){const n=nodesRef.current.find(n=>n.id===dragRef.current!.nodeId);if(n){n.isDragging=false;n.vx=0;n.vy=0};dragRef.current=null}
          panRef.current=null; mouseDownPos.current=null
          if(canvasRef.current) canvasRef.current.style.cursor='grab'
        }} />

      {/* Controls — top-left so it never overlaps the legend */}
      <div className="absolute top-3 left-3">
        <span className="text-[9px] px-2 py-1 rounded-md" style={{background:'rgba(0,0,0,0.65)',color:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.06)'}}>
          Scroll to zoom · Drag to pan · Click for details
        </span>
      </div>

      {/* Legend — bottom-right, stacked vertically */}
      <div className="absolute bottom-3 right-3 space-y-1">
        {(Object.entries(EDGE_LABELS) as [EdgeKind,string][]).filter(([k])=>edgeCounts[k]>0).map(([kind,label])=>(
          <div key={kind} className="flex items-center gap-1.5 px-2 py-0.5 rounded" style={{background:'rgba(0,0,0,0.7)',border:'1px solid rgba(255,255,255,0.07)'}}>
            <div className="w-5 h-0.5 rounded" style={{background:EDGE_COLORS[kind]}} />
            <span className="text-[9px]" style={{color:'rgba(255,255,255,0.4)'}}>{label}</span>
          </div>
        ))}
      </div>

      {/* Info panel */}
      {infoPanel && (
        <div className="absolute top-4 right-4 w-64 rounded-xl p-4 animate-slide-up"
          style={{background:'rgba(6,6,10,0.95)',border:'1px solid rgba(255,255,255,0.1)',backdropFilter:'blur(12px)',maxHeight:'60%',overflow:'auto'}}>
          <button onClick={()=>{setInfoPanel(null);focusRef.current=null}} className="absolute top-3 right-3 text-xs" style={{color:'rgba(255,255,255,0.3)'}}>✕</button>
          <p className="text-sm font-bold mb-0.5 pr-4" style={{color:'rgba(255,255,255,0.92)'}}>{infoPanel.title}</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{color:'rgba(255,255,255,0.35)'}}>{infoPanel.subtitle}</p>
          <div className="h-px mb-3" style={{background:'rgba(255,255,255,0.07)'}} />
          <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans" style={{color:'rgba(255,255,255,0.6)'}}>{infoPanel.detail}</pre>
        </div>
      )}
    </div>
  )
}
