'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { CompanyNetwork } from '@/components/company-network'
import { SignalCard } from '@/components/signal-card'
import { getFaviconUrl, getDomain } from '@/lib/utils'
import { getCached, setCached } from '@/lib/page-cache'
import { SIGNAL_LABELS } from '@/lib/types'
import type { Company, Signal } from '@/lib/types'

export default function FocusedNetworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [allCompanies, setAllCompanies] = useState<Company[]>(() => getCached<Company[]>('companies') ?? [])
  const [allSignals,   setAllSignals]   = useState<Signal[]>(() => getCached<Signal[]>('signals-500') ?? [])
  const [loading,      setLoading]      = useState(() => getCached('companies') === null)

  useEffect(() => {
    async function load() {
      const [cRes, sRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/signals?limit=500'),
      ])
      if (cRes.ok) { const d = await cRes.json(); setCached('companies', d); setAllCompanies(d) }
      if (sRes.ok) { const d = await sRes.json(); setCached('signals-500', d); setAllSignals(d) }
      setLoading(false)
    }
    load()
  }, [])

  const focal = allCompanies.find(c => c.id === id)

  // Determine which companies are connected to this one using the same
  // industry/rival/mention logic the graph uses, just keep companies
  // that share at least one connection type with the focal node
  const sigsByCompany = new Map<string, Signal[]>()
  for (const s of allSignals) {
    if (!sigsByCompany.has(s.company_id)) sigsByCompany.set(s.company_id, [])
    sigsByCompany.get(s.company_id)!.push(s)
  }

  const focalSigs = sigsByCompany.get(id) ?? []
  const focalTypes = new Set(focalSigs.map(s => s.type))

  const connected = allCompanies.filter(c => {
    if (c.id === id) return false
    const otherSigs = sigsByCompany.get(c.id) ?? []
    const otherTypes = new Set(otherSigs.map(s => s.type))
    // Shares a signal type
    if ([...focalTypes].some(t => otherTypes.has(t))) return true
    // Mention detection: focal's signals mention this company
    if (focalSigs.some(s => (s.title + (s.summary ?? '')).toLowerCase().includes(c.name.toLowerCase()))) return true
    // This company's signals mention the focal
    if (focal && otherSigs.some(s => (s.title + (s.summary ?? '')).toLowerCase().includes(focal.name.toLowerCase()))) return true
    return false
  })

  // Subgraph = focal + all connected companies
  const subgraphCompanies = focal ? [focal, ...connected] : []
  const subgraphSignals = allSignals.filter(s =>
    subgraphCompanies.some(c => c.id === s.company_id)
  )

  // Signals that mention other companies in the subgraph
  const crossSignals = focalSigs.filter(s => {
    const text = (s.title + (s.summary ?? '')).toLowerCase()
    return connected.some(c => text.includes(c.name.toLowerCase()))
  })

  const focalTypeCounts = Object.entries(
    focalSigs.reduce<Record<string, number>>((acc, s) => { acc[s.type] = (acc[s.type] ?? 0) + 1; return acc }, {})
  )

  if (loading) {
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="h-8 w-40 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-96 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
      </div>
    )
  }

  if (!focal) {
    return (
      <div className="text-center py-20">
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>Company not found.</p>
        <button onClick={() => router.push('/network')} className="mt-4 text-sm underline" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Back to network
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-slide-up">

      {/* Back */}
      <button onClick={() => router.push('/network')}
        className="flex items-center gap-2 text-sm transition-colors group w-fit"
        style={{ color: 'rgba(255,255,255,0.35)' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
        <ArrowLeft className="w-4 h-4" />
        Full network
      </button>

      {/* Focal company header */}
      <div className="flex items-center gap-4 p-5 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 0 20px rgba(255,255,255,0.07)' }}>
          <img src={getFaviconUrl(focal.website)} alt="" className="w-8 h-8 object-contain"
            onError={e => { const el = e.target as HTMLImageElement; el.style.display='none'; (el.parentElement as HTMLElement).innerHTML=`<span style="font-size:18px;font-weight:700;color:rgba(255,255,255,0.7)">${focal.name[0]}</span>` }} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>{focal.name}</h1>
          <div style={{ width: 24, height: 1.5, marginTop: 5, background: 'linear-gradient(90deg,rgba(255,255,255,0.2),transparent)', borderRadius: 99 }} />
          <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {getDomain(focal.website)} · {connected.length} connection{connected.length !== 1 ? 's' : ''} · {focalSigs.length} signals
          </p>
        </div>
        {/* Signal type pills */}
        <div className="flex flex-wrap gap-1.5 justify-end">
          {focalTypeCounts.map(([type, count]) => (
            <span key={type} className="px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
              {count} {SIGNAL_LABELS[type as keyof typeof SIGNAL_LABELS]}
            </span>
          ))}
        </div>
      </div>

      {/* Subgraph molecule — only focal + its connections */}
      {subgraphCompanies.length > 1 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Connection network ({connected.length} companies)
          </p>
          <div className="rounded-xl overflow-hidden" style={{ background: '#050505', border: '1px solid rgba(255,255,255,0.07)' }}>
            <CompanyNetwork companies={subgraphCompanies} signals={subgraphSignals} enableNavigation={false} />
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-10 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            No connections found yet. Connections appear once signals overlap with other tracked companies.
          </p>
        </div>
      )}

      {/* Connected companies list */}
      {connected.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Connected companies
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {connected.map(c => (
              <button key={c.id} onClick={() => router.push(`/network/${c.id}`)}
                className="flex items-center gap-3 p-3 rounded-xl text-left transition-all group"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)')}>
                <img src={getFaviconUrl(c.website)} alt="" className="w-7 h-7 rounded-lg object-contain flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onError={e => { const el = e.target as HTMLImageElement; el.style.display='none' }} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>{c.name}</p>
                  <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{getDomain(c.website)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cross-mention signals */}
      {crossSignals.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Signals that reference connected companies
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {crossSignals.map(s => (
              <SignalCard key={s.id} signal={{ ...s, company: focal } as Signal} showCompany={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
