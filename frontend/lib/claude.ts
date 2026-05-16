import Anthropic from '@anthropic-ai/sdk'
import type { SignalType, PullRequest, WorkflowRun } from './types'

const hasKey = !!process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-')

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

// Fallbacks are specific to the signal type + pull key detail from title when possible
function buildFallback(type: SignalType, title: string, company: string): string {
  const t = title.slice(0, 120)
  const fallbacks: Record<SignalType, string> = {
    FUNDING:        `${company} has new capital — expect accelerated hiring and product investment in the next 12-18 months.`,
    KEY_HIRE:       `New leadership at ${company} means strategy and vendor decisions may shift — reach out before they settle in.`,
    LAYOFF:         `${company} is cutting costs — decision-makers are under pressure and may be open to efficiency-focused solutions.`,
    PRODUCT_LAUNCH: `${company} shipped something new — assess whether it competes with or complements your offering.`,
    GENERAL:        `${t} — monitor for follow-on signals that confirm a directional shift.`,
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
        content: `You are a senior analyst writing signal insights. Be specific — name numbers, people, and concrete implications. No vague phrases like "worth monitoring" or "opens doors".

Company: ${params.companyName}
Signal type: ${params.signalType}
Headline: ${params.title}
Details: ${params.summary.slice(0, 400)}

Write exactly ONE sentence (max 25 words). State the specific business implication: who is affected, what decision window this opens, or what risk it signals. Use the actual details above.`,
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

export async function summarizePRDigest(params: {
  repoFullName: string
  prs: PullRequest[]
  workflowRuns: WorkflowRun[]
  periodStart: string
  periodEnd: string
}): Promise<string> {
  const merged = params.prs.filter(p => p.state === 'merged').length
  const open   = params.prs.filter(p => p.state === 'open').length
  const failed = params.workflowRuns.filter(w => w.conclusion === 'failure').length
  const total  = params.prs.length

  const fallback = `${total} PRs processed for ${params.repoFullName} between ${params.periodStart} and ${params.periodEnd}: ${merged} merged, ${open} open. ${failed > 0 ? `${failed} CI workflow(s) failed: investigate before next release.` : 'All CI workflows passed.'}`

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

export async function generateReleaseNotes(prs: PullRequest[]): Promise<string> {
  const mergedPRs = prs.filter(p => p.state === 'merged')
  if (mergedPRs.length === 0) return ''

  const groups: Record<string, PullRequest[]> = { feat: [], fix: [], chore: [], other: [] }
  for (const pr of mergedPRs) {
    const label = pr.labels.find(l =>
      ['feat', 'feature', 'fix', 'bug', 'bugfix', 'chore', 'deps', 'ci'].includes(l.toLowerCase())
    )?.toLowerCase()
    if (label === 'feat' || label === 'feature')       groups.feat.push(pr)
    else if (label === 'fix' || label === 'bug' || label === 'bugfix') groups.fix.push(pr)
    else if (label === 'chore' || label === 'deps' || label === 'ci')  groups.chore.push(pr)
    else groups.other.push(pr)
  }

  const fallback = [
    groups.feat.length  ? `## Features\n${groups.feat.map(p => `- ${p.title}`).join('\n')}`   : '',
    groups.fix.length   ? `## Bug Fixes\n${groups.fix.map(p => `- ${p.title}`).join('\n')}`   : '',
    groups.chore.length ? `## Chores\n${groups.chore.map(p => `- ${p.title}`).join('\n')}`    : '',
    groups.other.length ? `## Other\n${groups.other.map(p => `- ${p.title}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n')

  if (!hasKey) return fallback

  try {
    const client = getClient()
    const prList = mergedPRs.slice(0, 30).map(pr =>
      `#${pr.number} [${pr.labels.join(',') || 'unlabeled'}]: ${pr.title}`
    ).join('\n')

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Generate release notes in markdown from these merged PRs. Group by: Features, Bug Fixes, Chores, Other. Skip empty sections. Keep each entry to one line starting with "- ".\n\n${prList}`,
      }],
    })
    const content = message.content[0]
    return content.type === 'text' ? content.text.trim() : fallback
  } catch {
    return fallback
  }
}
