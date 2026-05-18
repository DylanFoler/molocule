import Anthropic from '@anthropic-ai/sdk'
import type { SignalType } from './types'

const hasKey = !!process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-')

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

const SYSTEM_PROMPT = `You are a senior analyst writing signal insights for a business intelligence tool. Your job is to extract the specific business implication from a signal, not to tell the reader to monitor anything.

Rules:
- State what this MEANS right now, not what to watch for later
- Name specific numbers, people, products, and percentages from the headline
- Connect the signal to a concrete business outcome: deals, headcount, pricing, roadmap, or competitive position
- Never use: monitor, watch for, follow-on, directional shift, worth noting, opens doors, may signal, keep an eye
- No em dashes. 2 to 3 sentences, max 60 words.`

// Fallbacks parse the title for specific keywords and derive an actual implication
function buildFallback(type: SignalType, title: string, company: string): string {
  const t = title.toLowerCase()

  if (type === 'FUNDING') {
    const amt = title.match(/\$[\d,.]+\s*[BMbm](?:illion)?/)?.[0]
    return amt
      ? `${company} closed ${amt} in new capital, signaling an aggressive growth phase. Expect hiring and product velocity to accelerate over the next two quarters as that capital is deployed.`
      : `${company} has new capital, which means accelerated hiring and product investment are likely in the next 12 to 18 months.`
  }

  if (type === 'KEY_HIRE') {
    const role = title.match(/\b(ceo|cto|coo|cfo|cpo|vp|svp|evp|chief [a-z]+ officer|president|head of [a-z]+)\b/i)?.[0]
    return role
      ? `A ${role.toLowerCase()} change at ${company} means the strategy and vendor relationships this person controls are in flux for the next 90 days before the new executive sets direction.`
      : `New senior leadership at ${company} means strategy and vendor decisions may shift. The first 90 days are when new executives reset priorities and existing relationships are most at risk.`
  }

  if (type === 'LAYOFF') {
    const pct = title.match(/(\d+)%/)?.[1]
    const count = title.match(/(\d[\d,]+)\s+(?:employees|workers|staff|jobs)/i)?.[1]
    return pct
      ? `${company} cutting ${pct}% of headcount signals a significant operational reset. Remaining teams will face increased scope and reduced bandwidth, which affects roadmap commitments and deal timelines.`
      : count
      ? `${company} cutting ${count} employees signals a significant operational reset. Remaining teams will carry increased scope, which affects roadmap commitments and deal timelines.`
      : `${company} is cutting costs. The teams that survive will carry increased scope and reduced bandwidth, which directly affects any roadmap commitments or active deals in flight.`
  }

  if (type === 'PRODUCT_LAUNCH') {
    const launchMatch = title.match(/(?:launches?|releases?|ships?|announces?|introduces?|debuts?|unveils?|open[- ]sources?)\s+([^,.|–—]{4,55})/i)
    const product = launchMatch?.[1]?.trim().replace(/\s*[-–—].*$/, '').trim()

    const isAI = /\bai\b|agent|model|llm|gpt|intelligence|copilot|assistant/i.test(title)
    const isAPI = /\bapi\b|sdk|developer|integration|webhook|platform/i.test(title)
    const isEnterprise = /enterprise|b2b|team|workspace|sso|compliance|soc/i.test(title)
    const isPricing = /pricing|plan|tier|free|pro|plus|subscription/i.test(title)

    const what = product ? `"${product}"` : 'a new product'

    if (isAI) return `${company} shipped ${what}, adding AI capabilities that directly compete with any tool currently handling that workflow for your customers. Evaluate whether your positioning addresses this before ${company}'s sales team does.`
    if (isAPI) return `${company} released ${what}, expanding the developer surface of their platform. New API capabilities tend to generate ecosystem lock-in quickly, so assess whether this creates a dependency risk for any integrations in your stack.`
    if (isEnterprise) return `${company} launched ${what} targeting enterprise buyers, signaling they are moving upmarket. This typically changes their sales motion, contract sizes, and the personas they prioritize, meaning mid-market and SMB customers may see slower support as a result.`
    if (isPricing) return `${company} changed their pricing with ${what}. Pricing restructures force existing customers to evaluate alternatives at renewal, which is a window to engage any ${company} customer who is unhappy with the new tiers.`
    return `${company} shipped ${what}. The companies most at risk are those whose core value proposition overlaps directly with what this launch does. Map it against your competitive landscape before it shows up in a prospect's RFP.`
  }

  // GENERAL: parse the title for a specific implication rather than generic text
  if (/limit|restrict|cap|tighten|throttl|block|suspend|ban/.test(t)) {
    return `${company} restricting access signals either supply-side pressure or a deliberate push toward a higher-margin customer segment. A pricing restructure or new enterprise tier is likely within 60 days.`
  }
  if (/partner|integrat|alliance|deal with|team(?:s| up) with/.test(t)) {
    return `${company} forming a partnership creates a new distribution surface that changes the competitive dynamics for anyone selling adjacent to either company. Evaluate whether this closes or opens a gap for your positioning.`
  }
  if (/acqui|merger|buys|acquires/.test(t)) {
    return `${company} completing an acquisition restructures its product surface and executive priorities for at least 12 months. Accounts that were locked in may now be in play as the combined entity resets its roadmap.`
  }
  if (/ipo|goes public|s-1|files.*sec|public offering/.test(t)) {
    return `${company} moving toward a public listing means the executive team will be focused on financial metrics and investor narrative for the next 6 to 12 months, which typically slows product risk-taking and partnership flexibility.`
  }
  if (/price|pricing|raises price|fee increase|cost increase/.test(t)) {
    return `${company} increasing prices signals the company believes its market position is strong enough to test price elasticity. Customers who are price-sensitive are now actively evaluating alternatives.`
  }
  if (/expand|launch(?:es)? in|enter|opens? in|new market|new region/.test(t)) {
    return `${company} entering a new market or region shifts where its sales and product resources are focused, which can create both new competitive pressure and new partnership opportunities in the target geography.`
  }
  if (/cut|shut|clos|exit|discontinu|end of/.test(t)) {
    return `${company} cutting or shutting down a product or market creates an immediate displacement event for its existing customers, who are now actively evaluating what to move to.`
  }
  if (/invest|bet|back|fund(?:s|ed)?.*startup/.test(t)) {
    return `${company} investing in or backing another company reveals where its strategic bets are, which is often a more reliable signal of future product direction than any roadmap announcement.`
  }
  const cleanTitle = title.replace(/\s*[-–|]\s*.{0,30}$/, '').trim()
  return `${cleanTitle}. This signals a deliberate shift in how ${company} operates or positions itself, which is worth reading against their recent product and hiring moves to understand the full direction.`
}

export async function analyzeSignal(params: {
  companyName: string
  signalType: SignalType
  title: string
  summary: string
}): Promise<string> {
  if (!hasKey) return buildFallback(params.signalType, params.title, params.companyName)

  try {
    const client = getClient()
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 350,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{
        role: 'user',
        content: `Company: ${params.companyName}
Signal type: ${params.signalType}
Headline: ${params.title}
Details: ${params.summary.slice(0, 800)}

Write 2 to 3 sentences stating the concrete business implications right now.`,
      }],
    })
    const content = message.content[0]
    if (content.type !== 'text') return buildFallback(params.signalType, params.title, params.companyName)
    const text = content.text.trim()
    if (/monitor|watch for|follow.?on|worth noting|opens doors|may signal|good time to|directional shift|keep an eye/i.test(text)) {
      return buildFallback(params.signalType, params.title, params.companyName)
    }
    return text
  } catch {
    return buildFallback(params.signalType, params.title, params.companyName)
  }
}
