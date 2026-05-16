'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Github, Linkedin, RefreshCw, Pencil } from 'lucide-react'
import { getFaviconUrl, getDomain, timeAgo } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { CompanyEditDialog } from '@/components/company-edit-dialog'
import type { Company, SignalType } from '@/lib/types'

const TYPE_COLORS: Record<string, string> = {
  FUNDING: '#4ade80', KEY_HIRE: 'rgba(255,255,255,0.8)',
  LAYOFF: '#f87171', PRODUCT_LAUNCH: '#fbbf24', GENERAL: 'rgba(255,255,255,0.4)',
}

export function CompanyCard({ company, onDelete, onUpdate, signalTypes, onScanComplete }: {
  company: Company
  onDelete?: (id: string) => void
  onUpdate?: (updated: Company) => void
  signalTypes?: SignalType[]
  onScanComplete?: () => void
}) {
  const router = useRouter()
  const [scanning,   setScanning]   = useState(false)
  const [editOpen,   setEditOpen]   = useState(false)
  const signalCount   = company.signal_count ?? 0
  const hasRecent     = !!company.latest_signal_at &&
    new Date(company.latest_signal_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  async function handleScan() {
    setScanning(true)
    try {
      const res  = await fetch(`/api/companies/${company.id}/scan`, { method: 'POST' })
      const data = await res.json()
      const found = data?.signals_found ?? 0
      toast({
        title: found > 0 ? `${found} new signal${found > 1 ? 's' : ''}` : 'No new signals',
        description: found > 0 ? `Fresh signals for ${company.name}.` : `Nothing new in the last 7 days.`,
      })
      onScanComplete ? onScanComplete() : router.refresh()
    } catch {
      toast({ title: 'Scan failed', variant: 'destructive' })
    } finally {
      setScanning(false)
    }
  }

  return (
    <div onClick={() => router.push(`/companies/${company.id}`)}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && router.push(`/companies/${company.id}`)}
      className="relative rounded-2xl overflow-hidden group transition-all duration-300 block cursor-pointer"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.13)'
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04)'
      }}>

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'rgba(255,255,255,0.09)' }} />

      <div className="p-5">
        {/* Atom nucleus header */}
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            {/* Outer orbital ring */}
            <div className="absolute inset-0 rounded-full animate-spin-slow pointer-events-none"
              style={{
                width: 60, height: 60, margin: -6,
                border: '1px dashed rgba(255,255,255,0.08)',
                borderRadius: '50%',
              }} />

            {/* Signal-type electron dots around the nucleus */}
            {signalTypes && signalTypes.slice(0, 4).map((type, i) => {
              const angle = (i / Math.max(signalTypes.length, 4)) * Math.PI * 2 - Math.PI / 2
              const r = 30
              const x = 24 + r * Math.cos(angle)
              const y = 24 + r * Math.sin(angle)
              return (
                <div key={type} className="absolute w-2 h-2 rounded-full"
                  style={{
                    left: x, top: y,
                    background: TYPE_COLORS[type] ?? 'rgba(255,255,255,0.4)',
                    boxShadow: `0 0 5px ${TYPE_COLORS[type] ?? 'rgba(255,255,255,0.4)'}`,
                    transform: 'translate(-50%, -50%)',
                  }} />
              )
            })}

            {/* Nucleus */}
            <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: hasRecent ? '0 0 16px rgba(255,255,255,0.12)' : 'none',
              }}>
              <img src={getFaviconUrl(company.website)} alt="" className="w-8 h-8 object-contain"
                onError={e => {
                  const el = e.target as HTMLImageElement
                  el.style.display = 'none'
                  ;(el.parentElement as HTMLElement).innerHTML = `<span style="font-size:18px;font-weight:700;color:rgba(255,255,255,0.7)">${company.name[0]}</span>`
                }} />
            </div>

            {/* Live pulse */}
            {hasRecent && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"
                  style={{ border: '2px solid #050505', boxShadow: '0 0 5px rgba(255,255,255,0.7)' }} />
              </span>
            )}
          </div>

          {/* Scan + edit + delete controls — stopPropagation prevents the card's navigation onClick */}
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => { e.preventDefault(); e.stopPropagation() }}>
            <button onClick={e => { e.stopPropagation(); handleScan() }} disabled={scanning} title="Scan for new signals"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)')}>
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={e => { e.stopPropagation(); setEditOpen(true) }} title="Edit company"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)')}>
              <Pencil className="w-3 h-3" />
            </button>
            {onDelete && (
              <button onClick={e => { e.stopPropagation(); onDelete(company.id) }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors"
                style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(248,113,113,0.8)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)')}>
                x
              </button>
            )}
          </div>
        </div>

        {/* Company info */}
        <div className="mt-1">
          <h3 className="text-sm font-semibold leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>
            {company.name}
          </h3>
          <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
            target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[11px] flex items-center gap-1 mt-0.5 transition-colors w-fit"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)')}>
            {getDomain(company.website)} <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mt-4 pt-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <span className="text-lg font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.82)' }}>{signalCount}</span>
            <span className="text-[11px] ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>signals</span>
          </div>

          <div className="flex items-center gap-2.5">
            {company.github_org && (
              <a href={`https://github.com/${company.github_org}`} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ color: 'rgba(255,255,255,0.28)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.28)')}>
                <Github className="w-3.5 h-3.5" />
              </a>
            )}
            {company.linkedin_url && (
              <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ color: 'rgba(255,255,255,0.28)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.28)')}>
                <Linkedin className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {company.latest_signal_at && (
          <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Last signal {timeAgo(company.latest_signal_at)}
          </p>
        )}
      </div>

      <CompanyEditDialog
        company={company}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={updated => { onUpdate?.(updated); onScanComplete?.() }}
      />
    </div>
  )
}
