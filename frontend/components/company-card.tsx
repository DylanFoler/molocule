'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, ExternalLink, Github, Linkedin, RefreshCw } from 'lucide-react'
import { getFaviconUrl, getDomain, timeAgo } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import type { Company } from '@/lib/types'

export function CompanyCard({ company, onDelete }: { company: Company; onDelete?: (id: string) => void }) {
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const signalCount = company.signal_count ?? 0
  const hasRecentSignal = company.latest_signal_at &&
    new Date(company.latest_signal_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  async function handleScan() {
    setScanning(true)
    try {
      const res = await fetch(`/api/companies/${company.id}/scan`, { method: 'POST' })
      const data = await res.json()
      const found = data?.signals_found ?? 0
      toast({
        title: found > 0 ? `${found} new signal${found > 1 ? 's' : ''}` : 'No new signals',
        description: found > 0 ? `Fresh signals detected for ${company.name}.` : `Nothing new in the last 7 days.`,
      })
      router.refresh()
    } catch {
      toast({ title: 'Scan failed', variant: 'destructive' })
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="relative rounded-xl overflow-hidden group transition-all duration-300"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.11)'
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
      }}>

      <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: 'rgba(255,255,255,0.08)' }} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <img src={getFaviconUrl(company.website)} alt="" className="w-6 h-6 object-contain"
                onError={e => {
                  const el = e.target as HTMLImageElement
                  el.style.display = 'none'
                  ;(el.parentElement as HTMLElement).innerHTML = `<span style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.5)">${company.name[0]}</span>`
                }} />
            </div>
            {hasRecentSignal && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" style={{ border: '1.5px solid #060606', boxShadow: '0 0 4px rgba(255,255,255,0.6)' }} />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold mb-0.5" style={{ color: 'rgba(255,255,255,0.82)' }}>{company.name}</h3>
            <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
              target="_blank" rel="noopener noreferrer"
              className="text-[11px] flex items-center gap-1 transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)')}>
              {getDomain(company.website)}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

        </div>

        <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.55)' }} />
            <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>{signalCount}</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>signals</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Scan for new signals */}
            <button onClick={handleScan} disabled={scanning}
              title="Scan for new signals"
              className="transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)')}>
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            </button>

            {company.github_org && (
              <a href={`https://github.com/${company.github_org}`} target="_blank" rel="noopener noreferrer"
                className="transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)')}>
                <Github className="w-3.5 h-3.5" />
              </a>
            )}
            {company.linkedin_url && (
              <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)')}>
                <Linkedin className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {company.latest_signal_at && (
          <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.22)' }}>
            Last signal {timeAgo(company.latest_signal_at)}
          </p>
        )}
      </div>

      {onDelete && (
        <button onClick={() => onDelete(company.id)}
          className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-all duration-200 w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold"
          style={{ color: 'rgba(255,255,255,0.25)', background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)'}>
          x
        </button>
      )}
    </div>
  )
}
