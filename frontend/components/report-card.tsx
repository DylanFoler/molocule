'use client'

import { useState } from 'react'
import { FileDown, GitMerge, GitPullRequest, CheckCircle2, XCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { formatDateRange, timeAgo } from '@/lib/utils'
import type { Digest } from '@/lib/types'

interface ReportCardProps { digest: Digest }

export function ReportCard({ digest }: ReportCardProps) {
  const [expanded, setExpanded] = useState(false)

  async function exportPDF() {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const margin = 20
    let y = margin

    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(`Dev Digest: ${digest.repo?.full_name ?? 'Repository'}`, margin, y)
    y += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Period: ${formatDateRange(digest.period_start, digest.period_end)}`, margin, y)
    y += 6
    doc.text(`Generated: ${new Date(digest.created_at).toLocaleDateString()}`, margin, y)
    y += 12

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('Executive Summary', margin, y)
    y += 6

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const summaryLines = doc.splitTextToSize(digest.summary, 170)
    doc.text(summaryLines, margin, y)
    y += summaryLines.length * 5 + 8

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Pull Requests', margin, y)
    y += 6

    digest.raw_data.prs.slice(0, 20).forEach((pr) => {
      if (y > 270) { doc.addPage(); y = margin }
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const status = pr.state === 'merged' ? '✓' : pr.state === 'open' ? '○' : '×'
      const lines = doc.splitTextToSize(`${status} #${pr.number}: ${pr.title} (@${pr.author})`, 170)
      doc.text(lines, margin, y)
      y += lines.length * 5 + 1
    })

    if (digest.raw_data.key_changes?.length) {
      y += 6
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Key Changes', margin, y)
      y += 6
      digest.raw_data.key_changes.forEach((change) => {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(`• ${change}`, 170)
        doc.text(lines, margin, y)
        y += lines.length * 5 + 1
      })
    }

    doc.save(`digest-${digest.repo?.name ?? 'repo'}-${digest.period_end.split('T')[0]}.pdf`)
  }

  const mergedPRs = digest.raw_data.prs.filter(p => p.state === 'merged')
  const openPRs   = digest.raw_data.prs.filter(p => p.state === 'open')
  const failedRuns = digest.raw_data.workflow_runs.filter(w => w.conclusion === 'failure')

  return (
    <div className="relative rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}>

      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.5), rgba(34,211,238,0.3), transparent)' }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground/90">{digest.repo?.full_name ?? 'Repository'}</span>
              {failedRuns.length > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  {failedRuns.length} failed
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDateRange(digest.period_start, digest.period_end)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={exportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(34,211,238,0.12)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 12px rgba(34,211,238,0.2)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(34,211,238,0.06)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
              }}>
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </button>
            <button onClick={() => setExpanded(!expanded)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 text-muted-foreground hover:text-foreground"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: GitMerge,    label: 'Merged', value: mergedPRs.length,                    color: '#4ade80', glow: 'rgba(74,222,128,0.15)'  },
            { icon: GitPullRequest, label: 'Open', value: openPRs.length,                     color: '#22d3ee', glow: 'rgba(34,211,238,0.15)'   },
            { icon: failedRuns.length > 0 ? XCircle : CheckCircle2,
              label: 'CI Runs', value: digest.raw_data.workflow_runs.length,
              color: failedRuns.length > 0 ? '#f87171' : '#4ade80',
              glow:  failedRuns.length > 0 ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)' },
          ].map(({ icon: Icon, label, value, color, glow }) => (
            <div key={label} className="flex items-center gap-2.5 p-2.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <Icon className="w-4 h-4" style={{ color, filter: `drop-shadow(0 0 4px ${color})` }} />
              <div>
                <div className="text-sm font-bold" style={{ color }}>{value}</div>
                <div className="text-[10px] text-muted-foreground">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* AI Summary */}
        <div className="p-3 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(236,72,153,0.03))',
            border: '1px solid rgba(168,85,247,0.15)',
          }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5"
              style={{ color: '#c084fc', filter: 'drop-shadow(0 0 4px rgba(192,132,252,0.6))' }} />
            <span className="text-xs font-semibold" style={{ color: '#c084fc' }}>AI Summary</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{digest.summary}</p>
        </div>
      </div>

      {/* Expanded PR list */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="px-5 py-4">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Pull Requests
            </h4>
            <div className="space-y-1">
              {digest.raw_data.prs.slice(0, 15).map((pr) => (
                <a key={pr.number} href={pr.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-2 rounded-lg transition-colors group"
                  style={{ borderRadius: '6px' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.05)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
                  {pr.state === 'merged'
                    ? <GitMerge className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#4ade80' }} />
                    : pr.state === 'open'
                    ? <GitPullRequest className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22d3ee' }} />
                    : <XCircle className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                  }
                  <span className="text-xs text-muted-foreground w-10 flex-shrink-0 font-mono">#{pr.number}</span>
                  <span className="text-xs text-foreground/80 flex-1 truncate">{pr.title}</span>
                  <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">@{pr.author}</span>
                </a>
              ))}
            </div>

            {digest.raw_data.key_changes?.length > 0 && (
              <>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-4 mb-3">
                  Key Changes
                </h4>
                <ul className="space-y-1.5">
                  {digest.raw_data.key_changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground/70">
                      <span style={{ color: '#a855f7', filter: 'drop-shadow(0 0 3px rgba(168,85,247,0.5))' }}>•</span>
                      {change}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      <div className="px-5 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <p className="text-[10px] text-muted-foreground/40">Generated {timeAgo(digest.created_at)}</p>
      </div>
    </div>
  )
}
