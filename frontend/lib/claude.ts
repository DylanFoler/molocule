import Anthropic from '@anthropic-ai/sdk'
import type { SignalType } from './types'

const hasKey = !!process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-')

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

// Fallbacks are specific to the signal type + pull key detail from title when possible
function buildFallback(type: SignalType, title: string, company: string): string {
  const t = title.slice(0, 120)
  const fallbacks: Record<SignalType, string> = {
    FUNDING:        `${company} has new capital, which means accelerated hiring and product investment are likely in the next 12 to 18 months.`,
    KEY_HIRE:       `New leadership at ${company} means strategy and vendor decisions may shift. Reach out before the new executive settles into existing relationships.`,
    LAYOFF:         `${company} is cutting costs. Decision-makers are under pressure and may be open to efficiency-focused solutions that reduce overhead.`,
    PRODUCT_LAUNCH: `${company} shipped something new. Assess whether it competes with or complements your current offering before customers ask you about it.`,
    GENERAL:        `${t}. Monitor for follow-on signals that confirm whether this is a directional shift or a one-off event.`,
  }
  return fallbacks[type]
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
      max_tokens: 180,
      messages: [{
        role: 'user',
        content: `You are a senior analyst writing signal insights. Be specific: name numbers, people, and concrete implications. No vague phrases like "worth monitoring" or "opens doors". Do not use em dashes.

Company: ${params.companyName}
Signal type: ${params.signalType}
Headline: ${params.title}
Details: ${params.summary.slice(0, 400)}

Write exactly ONE sentence (max 28 words). State the specific business implication: who is affected, what decision window this opens, or what risk it signals. Use the actual details above. Use commas or colons instead of dashes.`,
      }],
    })
    const content = message.content[0]
    if (content.type !== 'text') return buildFallback(params.signalType, params.title, params.companyName)
    const text = content.text.trim()
    // Reject generic outputs and fall back
    if (/worth monitoring|opens doors|may signal|good time to/i.test(text)) {
      return buildFallback(params.signalType, params.title, params.companyName)
    }
    return text
  } catch {
    return buildFallback(params.signalType, params.title, params.companyName)
  }
}

