'use client'

import { useState, useEffect } from 'react'
import { CompanyNetwork } from '@/components/company-network'
import { AutoRefresh } from '@/components/auto-refresh'
import { PageHeader } from '@/components/page-header'
import type { Company, Signal } from '@/lib/types'
import { Network } from 'lucide-react'

export default function NetworkPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [signals,   setSignals]   = useState<Signal[]>([])
  const [loading,   setLoading]   = useState(true)

  async function fetchData() {
    const [cRes, sRes] = await Promise.all([fetch('/api/companies'), fetch('/api/signals?limit=200')])
    if (cRes.ok) setCompanies(await cRes.json())
    if (sRes.ok) setSignals(await sRes.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const edgeCount = (() => {
    const m = new Map<string, Set<string>>()
    for (const s of signals) {
      if (!m.has(s.company_id)) m.set(s.company_id, new Set())
      m.get(s.company_id)!.add(s.type)
    }
    let n = 0
    for (let i = 0; i < companies.length; i++)
      for (let j = i + 1; j < companies.length; j++)
        if ([...( m.get(companies[i].id) ?? new Set())].some(t => (m.get(companies[j].id) ?? new Set()).has(t))) n++
    return n
  })()

  return (
    <div className="space-y-5 animate-slide-up">
      <AutoRefresh intervalMs={60_000} />

      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Network className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.5)' }} />
            Company Network
          </span>
        }
        subtitle={`${companies.length} companies · ${edgeCount} signal connections · drag nodes to rearrange`}
      />

      {loading ? (
        <div className="rounded-xl animate-pulse"
          style={{ height: 500, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }} />
      ) : companies.length === 0 ? (
        <div className="rounded-xl p-16 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Network className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>No companies tracked yet</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Add companies or load demo data to see the network.</p>
          <a href="/companies" className="inline-flex mt-4 px-4 py-2 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}>
            Add companies
          </a>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden"
          style={{ background: '#050505', border: '1px solid rgba(255,255,255,0.07)' }}>
          <CompanyNetwork companies={companies} signals={signals} />
        </div>
      )}

      {edgeCount > 0 && (
        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Lines connect companies that share the same signal type in the last 7 days. Brighter lines indicate stronger overlap.
        </p>
      )}
    </div>
  )
}
