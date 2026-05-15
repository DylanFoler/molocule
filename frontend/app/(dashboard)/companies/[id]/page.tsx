'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ExternalLink, Github, Linkedin, RefreshCw,
  Loader2, Sparkles, Globe,
} from 'lucide-react'
import { SignalCard } from '@/components/signal-card'
import { AutoRefresh } from '@/components/auto-refresh'
import { getFaviconUrl, getDomain, timeAgo } from '@/lib/utils'
import { SIGNAL_LABELS } from '@/lib/types'
import { toast } from '@/hooks/use-toast'
import type { Company, Signal, SignalType } from '@/lib/types'

const TYPE_COLORS: Record<string, string> = {
  FUNDING: '#4ade80', KEY_HIRE: 'rgba(255,255,255,0.75)',
  LAYOFF: '#f87171', PRODUCT_LAUNCH: '#fbbf24', GENERAL: 'rgba(255,255,255,0.35)',
}

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [company,  setCompany]  = useState<Company | null>(null)
  const [signals,  setSignals]  = useState<Signal[]>([])
  const [loading,  setLoading]  = useState(true)
  const [scanning, setScanning] = useState(false)
  const [typeFilter, setTypeFilter] = useState<SignalType | 'ALL'>('ALL')

  async function fetchData() {
    const res = await fetch(`/api/companies/${id}`)
    if (!res.ok) { router.push('/companies'); return }
    const data = await res.json()
    setCompany(data.company)
    setSignals(data.signals)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  async function handleScan() {
    setScanning(true)
    try {
      const res  = await fetch(`/api/companies/${id}/scan`, { method: 'POST' })
      const data = await res.json()
      const found = data?.signals_found ?? 0
      toast({
        title: found > 0 ? `${found} new signal${found > 1 ? 's' : ''}` : 'No new signals',
        description: found > 0 ? 'Feed updated.' : 'Nothing new in the last 7 days.',
      })
      await fetchData()
    } catch {
      toast({ title: 'Scan failed', variant: 'destructive' })
    } finally {
      setScanning(false)
    }
  }

  // Signal type breakdown
  const typeCounts = signals.reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1; return acc
  }, {})

  const filtered = typeFilter === 'ALL' ? signals : signals.filter(s => s.type === typeFilter)

  if (loading) {
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="h-8 w-40 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-40 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
      </div>
    )
  }

  if (!company) return null

  return (
    <div className="space-y-6 animate-slide-up">
      <AutoRefresh intervalMs={60_000} />

      {/* Back */}
      <button onClick={() => router.push('/companies')}
        className="flex items-center gap-2 text-sm transition-colors group w-fit"
        style={{ color: 'rgba(255,255,255,0.35)' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
        <ArrowLeft className="w-4 h-4" />
        Companies
      </button>

      {/* Company hero */}
      <div className="relative rounded-2xl overflow-hidden p-6"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'rgba(255,255,255,0.07)' }} />

        <div className="flex items-start gap-5">
          {/* Atom nucleus */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-full animate-spin-slow pointer-events-none"
              style={{ width: 80, height: 80, margin: -8, border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '50%' }} />
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 0 20px rgba(255,255,255,0.05)' }}>
              <img src={getFaviconUrl(company.website)} alt="" className="w-10 h-10 object-contain"
                onError={e => {
                  const el = e.target as HTMLImageElement
                  el.style.display = 'none'
                  ;(el.parentElement as HTMLElement).innerHTML = `<span style="font-size:22px;font-weight:700;color:rgba(255,255,255,0.7)">${company.name[0]}</span>`
                }} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>
                  {company.name}
                </h1>
                <div style={{ width: 28, height: 1.5, marginTop: 6, background: 'linear-gradient(90deg, rgba(255,255,255,0.2), transparent)', borderRadius: 99 }} />
                <a href={company.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 mt-2 text-sm transition-colors w-fit"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
                  <Globe className="w-3.5 h-3.5" />
                  {getDomain(company.website)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <button onClick={handleScan} disabled={scanning}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)')}>
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {scanning ? 'Scanning...' : 'Scan now'}
              </button>
            </div>

            {/* Links row */}
            <div className="flex items-center gap-4 mt-4">
              {company.github_org && (
                <a href={`https://github.com/${company.github_org}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs transition-colors"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
                  <Github className="w-3.5 h-3.5" />
                  {company.github_org}
                </a>
              )}
              {company.linkedin_url && (
                <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs transition-colors"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
                  <Linkedin className="w-3.5 h-3.5" />
                  LinkedIn
                </a>
              )}
              {company.latest_signal_at && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Last signal {timeAgo(company.latest_signal_at)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Signal type breakdown */}
      {Object.keys(typeCounts).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {(Object.entries(typeCounts) as [SignalType, number][]).map(([type, count]) => (
            <button key={type}
              onClick={() => setTypeFilter(typeFilter === type ? 'ALL' : type)}
              className="p-3 rounded-xl text-left transition-all"
              style={{
                background: typeFilter === type ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)',
                border: typeFilter === type ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.06)',
              }}>
              <div className="text-xl font-bold tabular-nums" style={{ color: TYPE_COLORS[type] ?? 'rgba(255,255,255,0.7)' }}>
                {count}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {SIGNAL_LABELS[type]}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Signals */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>
              Signal History
            </h2>
            <div style={{ width: 20, height: 1.5, marginTop: 5, background: 'linear-gradient(90deg, rgba(255,255,255,0.15), transparent)', borderRadius: 99 }} />
          </div>
          {typeFilter !== 'ALL' && (
            <button onClick={() => setTypeFilter('ALL')}
              className="text-xs transition-colors"
              style={{ color: 'rgba(255,255,255,0.35)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
              Clear filter
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl p-10 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Sparkles className="w-6 h-6 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {typeFilter !== 'ALL' ? `No ${SIGNAL_LABELS[typeFilter]} signals yet.` : 'No signals yet. Click Scan now to pull recent news.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((signal, i) => (
              <div key={signal.id} className="animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
                <SignalCard signal={{ ...signal, company } as Signal} showCompany={false} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
