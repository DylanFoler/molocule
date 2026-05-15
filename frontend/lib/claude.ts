import Anthropic from '@anthropic-ai/sdk'
import type { SignalType, PullRequest, WorkflowRun } from './types'

const hasKey = !!process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-')

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

const SIGNAL_FALLBACKS: Record<SignalType, string> = {
  FUNDING:        'New funding signals accelerated growth and increased budget for new tools.',
  KEY_HIRE:       'Leadership hire suggests strategic expansion — good time to engage.',
  LAYOFF:         'Workforce reduction may signal budget tightening or pivot in priorities.',
  PRODUCT_LAUNCH: 'New product launch opens the door for complementary solution conversations.',
  GENERAL:        'Company activity detected — worth monitoring for follow-up signals.',
}

export async function analyzeSignal(params: {
  companyName: string
  signalType: SignalType
  title: string
  summary: string
}): Promise<string> {
  if (!hasKey) return SIGNAL_FALLBACKS[params.signalType]

  try {
    const client = getClient()
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `You are a GTM analyst writing micro-insights for sales and marketing teams.

Company: ${params.companyName}
Signal: ${params.signalType.toLowerCase().replace('_', ' ')}
Title: ${params.title}
Context: ${params.summary}

Write ONE sharp sentence (max 20 words) explaining why this signal matters for a sales rep. No fluff.`,
      }],
    })
    const content = message.content[0]
    return content.type === 'text' ? content.text.trim() : SIGNAL_FALLBACKS[params.signalType]
  } catch {
    return SIGNAL_FALLBACKS[params.signalType]
  }
}

export async function summarizePRDigest(params: {
  repoFullName: string
  prs: PullRequest[]
  workflowRuns: WorkflowRun[]
  periodStart: string
  periodEnd: string
}): Promise<string> {
  const merged  = params.prs.filter(p => p.state === 'merged').length
  const open    = params.prs.filter(p => p.state === 'open').length
  const failed  = params.workflowRuns.filter(w => w.conclusion === 'failure').length
  const total   = params.prs.length

  const fallback = `${total} PRs processed for ${params.repoFullName} between ${params.periodStart} and ${params.periodEnd}: ${merged} merged, ${open} open. ${failed > 0 ? `${failed} CI workflow(s) failed — investigate before next release.` : 'All CI workflows passed.'}`

  if (!hasKey) return fallback

  try {
    const client = getClient()
    const prList = params.prs.slice(0, 20).map(pr =>
      `- [${pr.state.toUpperCase()}] #${pr.number}: ${pr.title} (@${pr.author})`
    ).join('\n')

    const workflowSummary = params.workflowRuns.slice(0, 10).map(w =>
      `- ${w.name}: ${w.conclusion ?? w.status}`
    ).join('\n')

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are a senior engineering lead writing a weekly digest for stakeholders.

Repository: ${params.repoFullName}
Period: ${params.periodStart} to ${params.periodEnd}

Pull Requests (${total} total):
${prList}

CI/CD Workflow Runs:
${workflowSummary}

Write a concise executive summary (3-4 sentences) covering: what shipped, engineering health, and any blockers or risks.`,
      }],
    })
    const content = message.content[0]
    return content.type === 'text' ? content.text.trim() : fallback
  } catch {
    return fallback
  }
}

export async function generateKeyChanges(prs: PullRequest[]): Promise<string[]> {
  const mergedPRs = prs.filter(pr => pr.state === 'merged').slice(0, 15)
  if (mergedPRs.length === 0) return []

  const fallback = mergedPRs.slice(0, 5).map(pr => pr.title)

  if (!hasKey) return fallback

  try {
    const client = getClient()
    const prList = mergedPRs.map(pr => `#${pr.number}: ${pr.title}`).join('\n')

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Extract 3-5 key changes from these merged PRs as bullet points. Each bullet max 10 words. Focus on user-facing or architectural impact.\n\n${prList}\n\nReturn only the bullets, one per line, starting with "•".`,
      }],
    })
    const content = message.content[0]
    if (content.type !== 'text') return fallback
    return content.text.split('\n').filter(l => l.trim().startsWith('•')).map(l => l.replace(/^•\s*/, '').trim())
  } catch {
    return fallback
  }
}
