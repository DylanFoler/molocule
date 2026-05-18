export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import Anthropic from '@anthropic-ai/sdk'

export interface CompanySuggestion {
  name: string
  website: string
  reason: string
}

const hasKey = !!process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-')

function fallbackSuggestions(description: string): CompanySuggestion[] {
  const d = description.toLowerCase()
  if (/fintech|payment|banking|finance|spend/.test(d)) return [
    { name: 'Stripe',   website: 'stripe.com',   reason: 'Dominant payments infrastructure across online businesses.' },
    { name: 'Brex',     website: 'brex.com',     reason: 'Corporate cards and spend management targeting startups.' },
    { name: 'Ramp',     website: 'ramp.com',     reason: 'Finance automation platform competing directly with Brex.' },
    { name: 'Plaid',    website: 'plaid.com',    reason: 'Banking data connectivity used by most fintech products.' },
    { name: 'Rippling', website: 'rippling.com', reason: 'HR and finance platform expanding into banking.' },
    { name: 'Mercury',  website: 'mercury.com',  reason: 'Business banking built for startups and tech companies.' },
  ]
  if (/\bai\b|llm|model|openai|anthropic|agent/.test(d)) return [
    { name: 'OpenAI',     website: 'openai.com',      reason: 'Leading LLM provider and creator of ChatGPT.' },
    { name: 'Anthropic',  website: 'anthropic.com',   reason: 'Claude creator, safety-focused AI research lab.' },
    { name: 'Cohere',     website: 'cohere.com',      reason: 'Enterprise LLM infrastructure for private deployments.' },
    { name: 'Mistral',    website: 'mistral.ai',      reason: 'Open-weight model competitor gaining enterprise traction.' },
    { name: 'Perplexity', website: 'perplexity.ai',   reason: 'AI-native search engine competing with ChatGPT.' },
    { name: 'Together AI', website: 'together.ai',    reason: 'Open source model hosting and inference platform.' },
  ]
  if (/devtool|developer|engineer|saas|software|product/.test(d)) return [
    { name: 'Linear',   website: 'linear.app',       reason: 'Issue tracking built for modern engineering teams.' },
    { name: 'Vercel',   website: 'vercel.com',        reason: 'Frontend deployment and developer experience platform.' },
    { name: 'Notion',   website: 'notion.so',         reason: 'All-in-one workspace competing with Linear on project management.' },
    { name: 'Figma',    website: 'figma.com',         reason: 'Design collaboration tool widely used by product teams.' },
    { name: 'Datadog',  website: 'datadoghq.com',     reason: 'Observability and monitoring for engineering orgs.' },
    { name: 'Retool',   website: 'retool.com',        reason: 'Internal tool builder with strong enterprise traction.' },
  ]
  return [
    { name: 'OpenAI',    website: 'openai.com',    reason: 'Dominant AI platform worth tracking across most sectors.' },
    { name: 'Stripe',    website: 'stripe.com',    reason: 'Payments infrastructure relevant to most B2B businesses.' },
    { name: 'Anthropic', website: 'anthropic.com', reason: 'Claude creator and fast-growing AI research lab.' },
    { name: 'Linear',    website: 'linear.app',    reason: 'Fast-growing DevTools company with frequent product signals.' },
    { name: 'Vercel',    website: 'vercel.com',    reason: 'Developer platform with strong hiring and product signal activity.' },
    { name: 'Figma',     website: 'figma.com',     reason: 'Design tool with high acquisition and enterprise signal activity.' },
  ]
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const description: string = (body.description ?? '').trim()
  if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 })

  if (!hasKey) return NextResponse.json({ suggestions: fallbackSuggestions(description) })

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `You are a company intelligence assistant. Given a description of what someone tracks (their industry, competitors, customers, or market), suggest 6 to 8 companies they should monitor for signals.

Return ONLY a valid JSON array, no markdown or explanation. Each object must have:
- name: official company name
- website: domain only, no https (e.g. stripe.com)
- reason: one sentence explaining why this company is relevant to track`,
      messages: [{ role: 'user', content: description }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const suggestions = JSON.parse(clean) as CompanySuggestion[]
    if (!Array.isArray(suggestions)) throw new Error()
    return NextResponse.json({ suggestions: suggestions.slice(0, 8) })
  } catch {
    return NextResponse.json({ suggestions: fallbackSuggestions(description) })
  }
}
