'use client'

import { useState, useEffect, useCallback } from 'react'
import { Building2, Search, RefreshCw, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CompanyCard } from '@/components/company-card'
import { PageHeader } from '@/components/page-header'
import { CompanyForm } from '@/components/company-form'
import { LoadDemoButton } from '@/components/load-demo-button'
import { toast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import type { Company, Signal, SignalType } from '@/lib/types'

export default function CompaniesPage() {
  const router = useRouter()
  const [companies,   setCompanies]   = useState<Company[]>([])
  const [signals,     setSignals]     = useState<Signal[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [scanningAll, setScanningAll] = useState(false)

  const fetchData = useCallback(async () => {
    const [cRes, sRes] = await Promise.all([
      fetch('/api/companies'),
      fetch('/api/signals?limit=500'),
    ])
    if (cRes.ok) setCompanies(await cRes.json())
    if (sRes.ok) setSignals(await sRes.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30_000)
    return () => clearInterval(id)
  }, [fetchData])

  async function handleDelete(id: string) {
    const res = await fetch(`/api/companies?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCompanies(c => c.filter(co => co.id !== id))
      toast({ title: 'Company removed' })
    }
  }

  async function handleScanAll() {
    setScanningAll(true)
    try {
      const res  = await fetch('/api/companies/scan-all', { method: 'POST' })
      const data = await res.json()
      const found = data?.total_found ?? 0
      toast({
        title: found > 0 ? `${found} new signal${found > 1 ? 's' : ''} found` : 'No new signals',
        description: found > 0
          ? `Scanned ${data.scanned} companies.`
          : `All ${data.scanned} companies are up to date.`,
      })
      router.refresh()
      await fetchData()
    } catch {
      toast({ title: 'Scan failed', variant: 'destructive' })
    } finally {
      setScanningAll(false)
    }
  }

  // Build signal-type set per company
  const signalTypesByCompany = new Map<string, SignalType[]>()
  for (const s of signals) {
    if (!signalTypesByCompany.has(s.company_id)) signalTypesByCompany.set(s.company_id, [])
    const arr = signalTypesByCompany.get(s.company_id)!
    if (!arr.includes(s.type)) arr.push(s.type)
  }

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.website.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header */}
      <PageHeader
        title="Companies"
        subtitle={`${companies.length} ${companies.length === 1 ? 'company' : 'companies'} tracked`}
        right={
          <>
            {companies.length > 0 && (
              <button onClick={handleScanAll} disabled={scanningAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={{ color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)')}>
                {scanningAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {scanningAll ? 'Scanning...' : 'Scan all'}
              </button>
            )}
            <CompanyForm onSuccess={fetchData} />
          </>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
        <Input placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl animate-pulse"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Building2 className="w-7 h-7 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {search ? 'No companies match your search' : 'No companies yet'}
          </p>
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {search ? 'Try a different term.' : 'Track a company or load demo data to see the full experience.'}
          </p>
          {!search && <LoadDemoButton variant="compact" />}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(company => (
            <CompanyCard
              key={company.id}
              company={company}
              onDelete={handleDelete}
              signalTypes={signalTypesByCompany.get(company.id)}
              onScanComplete={fetchData}
            />
          ))}
        </div>
      )}
    </div>
  )
}
