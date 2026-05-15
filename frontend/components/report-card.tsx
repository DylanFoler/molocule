'use client'

import { useState } from 'react'
import {
  FileDown, GitMerge, GitPullRequest, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Sparkles, Clock, Users, BarChart2,
} from 'lucide-react'
import { formatDateRange, timeAgo } from '@/lib/utils'
import type { Digest } from '@/lib/types'

interface ReportCardProps { digest: Digest }

function fmt(hours: number | null | undefined): string {
  if (hours == null) return 'N/A'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${Math.round(hours)}h`
  return `${(hours / 24).toFixed(1)}d`
}

export function ReportCard({ digest }: ReportCardProps) {
  const [expanded, setExpanded] = useState(false)

  const mergedPRs  = digest.raw_data.prs.filter(p => p.state === 'merged')
  const openPRs    = digest.raw_data.prs.filter(p => p.state === 'open')
  const failedRuns = digest.raw_data.workflow_runs.filter(w => w.conclusion === 'failure')
  const failedJobs = digest.failed_job_names ?? []

  const prDist = digest.pr_size_distribution ?? { xs: 0, s: 0, m: 0, l: 0 }
  const distTotal = prDist.xs + prDist.s + prDist.m + prDist.l

  const contributorMap: Record<string, { total: number; merged: number }> = {}
  for (const pr of digest.raw_data.prs) {
    if (!contributorMap[pr.author]) contributorMap[pr.author] = { total: 0, merged: 0 }
    contributorMap[pr.author].total++
    if (pr.state === 'merged') contributorMap[pr.author].merged++
  }
  const contributors = Object.entries(contributorMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)

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

    if (digest.avg_cycle_time_hours != null || digest.avg_review_time_hours != null) {
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Velocity', margin, y)
      y += 6
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Avg cycle time: ${fmt(digest.avg_cycle_time_hours)}   Avg review time: ${fmt(digest.avg_review_time_hours)}`, margin, y)
      y += 10
    }

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Pull Requests', margin, y)
    y += 6
    digest.raw_data.prs.slice(0, 20).forEach((pr) => {
      if (y > 270) { doc.addPage(); y = margin }
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const status = pr.state === 'merged' ? 'MERGED' : pr.state === 'open' ? 'OPEN' : 'CLOSED'
      const lines = doc.splitTextToSize(`[${status}] #${pr.number}: ${pr.title} (@${pr.author})`, 170)
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
        if (y > 270) { doc.addPage(); y = margin }
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(`- ${change}`, 170)
        doc.text(lines, margin, y)
        y += lines.length * 5 + 1
      })
    }

    if (digest.release_notes) {
      y += 6
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Release Notes', margin, y)
      y += 6
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const rnLines = doc.splitTextToSize(digest.release_notes.replace(/#{1,3} /g, ''), 170)
      doc.text(rnLines, margin, y)
    }

    doc.save(`digest-${digest.repo?.name ?? 'repo'}-${digest.period_end.split('T')[0]}.pdf`)
  }

  return (
    <div className="relative rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}>

      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'rgba(255,255,255,0.07)' }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                {digest.repo?.full_name ?? 'Repository'}
              </span>
              {failedJobs.length > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  {failedJobs.length} job{failedJobs.length > 1 ? 's' : ''} failed
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {formatDateRange(digest.period_start, digest.period_end)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={exportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'
              }}>
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </button>
            <button onClick={() => setExpanded(!expanded)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[
            { icon: GitMerge,     label: 'Merged',  value: mergedPRs.length,               good: true },
            { icon: GitPullRequest, label: 'Open',  value: openPRs.length,                 good: null },
            { icon: failedRuns.length > 0 ? XCircle : CheckCircle2, label: 'CI Runs',
              value: digest.raw_data.workflow_runs.length,  good: failedRuns.length === 0 },
            { icon: Clock,        label: 'Cycle',   value: fmt(digest.avg_cycle_time_hours), good: null },
            { icon: Clock,        label: 'Review',  value: fmt(digest.avg_review_time_hours), good: null },
          ].map(({ icon: Icon, label, value, good }) => (
            <div key={label} className="flex flex-col items-center p-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <Icon className="w-3.5 h-3.5 mb-1"
                style={{ color: good === true ? 'rgba(255,255,255,0.7)' : good === false ? '#f87171' : 'rgba(255,255,255,0.4)' }} />
              <div className="text-xs font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.82)' }}>{value}</div>
              <div className="text-[9px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* PR size distribution bar */}
        {distTotal > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                PR size distribution
              </span>
              <div className="flex items-center gap-2 text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {[['XS', prDist.xs, 0.3], ['S', prDist.s, 0.5], ['M', prDist.m, 0.7], ['L', prDist.l, 0.9]].map(([k, v, op]) =>
                  (v as number) > 0 ? <span key={k as string}>{k} {v}</span> : null
                )}
              </div>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
              {[
                { key: 'xs', count: prDist.xs, opacity: 0.28 },
                { key: 's',  count: prDist.s,  opacity: 0.48 },
                { key: 'm',  count: prDist.m,  opacity: 0.68 },
                { key: 'l',  count: prDist.l,  opacity: 0.88 },
              ].map(({ key, count, opacity }) =>
                count > 0 ? (
                  <div key={key} style={{ flex: count, background: `rgba(255,255,255,${opacity})` }} />
                ) : null
              )}
            </div>
          </div>
        )}

        {/* Failed CI jobs */}
        {failedJobs.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5"
              style={{ color: 'rgba(248,113,113,0.7)' }}>
              Failed jobs
            </p>
            <div className="flex flex-wrap gap-1.5">
              {failedJobs.map(name => (
                <span key={name}
                  className="px-2 py-0.5 rounded text-[10px] font-mono"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AI Summary */}
        <div className="p-3 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)', filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.3))' }} />
            <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>AI Summary</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{digest.summary}</p>
        </div>
      </div>

      {/* Expanded sections */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="px-5 py-4 space-y-6">

            {/* PR list */}
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'rgba(255,255,255,0.35)' }}>Pull Requests</h4>
              <div className="space-y-1">
                {digest.raw_data.prs.slice(0, 15).map((pr) => (
                  <a key={pr.number} href={pr.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2 rounded-lg transition-colors"
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
                    {pr.state === 'merged'
                      ? <GitMerge className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.55)' }} />
                      : pr.state === 'open'
                      ? <GitPullRequest className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />
                      : <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
                    }
                    <span className="text-xs font-mono w-10 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>#{pr.number}</span>
                    <span className="text-xs flex-1 truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{pr.title}</span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>@{pr.author}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Key changes */}
            {digest.raw_data.key_changes?.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>Key Changes</h4>
                <ul className="space-y-1.5">
                  {digest.raw_data.key_changes.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      <span style={{ color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>+</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contributor table */}
            {contributors.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <Users className="w-3 h-3 inline mr-1" />
                  Contributors
                </h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ color: 'rgba(255,255,255,0.3)' }}>
                      <th className="text-left pb-2 font-medium">Author</th>
                      <th className="text-right pb-2 font-medium">PRs</th>
                      <th className="text-right pb-2 font-medium">Merged</th>
                      <th className="text-right pb-2 font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributors.map(([author, stats]) => (
                      <tr key={author} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td className="py-1.5 font-mono" style={{ color: 'rgba(255,255,255,0.65)' }}>@{author}</td>
                        <td className="py-1.5 text-right tabular-nums" style={{ color: 'rgba(255,255,255,0.55)' }}>{stats.total}</td>
                        <td className="py-1.5 text-right tabular-nums" style={{ color: 'rgba(255,255,255,0.55)' }}>{stats.merged}</td>
                        <td className="py-1.5 text-right tabular-nums" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {stats.total > 0 ? `${Math.round((stats.merged / stats.total) * 100)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Stale PRs callout */}
            {(digest.stale_pr_count ?? 0) > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <BarChart2 className="w-3.5 h-3.5" style={{ color: 'rgba(251,191,36,0.7)' }} />
                <p className="text-[11px]" style={{ color: 'rgba(251,191,36,0.7)' }}>
                  {digest.stale_pr_count} PR{digest.stale_pr_count > 1 ? 's' : ''} with no activity in 7+ days
                </p>
              </div>
            )}

            {/* Release notes */}
            {digest.release_notes && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>Release Notes</h4>
                <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono"
                  style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {digest.release_notes}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-5 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Generated {timeAgo(digest.created_at)}</p>
      </div>
    </div>
  )
}
