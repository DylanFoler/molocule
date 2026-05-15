'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Filter } from 'lucide-react'
import { SignalCard } from '@/components/signal-card'
import { PageHeader } from '@/components/page-header'
import type { Signal, SignalType } from '@/lib/types'
import { SIGNAL_LABELS } from '@/lib/types'

const FILTER_TYPES: Array<{ value: SignalType | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'FUNDING', label: 'Funding' },
  { value: 'KEY_HIRE', label: 'Key Hire' },
  { value: 'LAYOFF', label: 'Layoff' },
  { value: 'PRODUCT_LAUNCH', label: 'Launch' },
  { value: 'GENERAL', label: 'General' },
]

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<SignalType | 'ALL'>('ALL')

  useEffect(() => {
    async function fetchSignals() {
      const params = typeFilter !== 'ALL' ? `?type=${typeFilter}` : ''
      const res = await fetch(`/api/signals${params}`)
      if (res.ok) setSignals(await res.json())
      setLoading(false)
    }
    fetchSignals()
    const id = setInterval(fetchSignals, 30_000)
    return () => clearInterval(id)
  }, [typeFilter])

  const grouped = signals.reduce<Record<string, Signal[]>>((acc, signal) => {
    const date = new Date(signal.detected_at).toDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(signal)
    return acc
  }, {})

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Signal Feed"
        subtitle={`${signals.length} signals detected across all companies`}
      />

      {/* Type filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
        {FILTER_TYPES.map(({ value, label }) => {
          const active = typeFilter === value
          return (
            <button key={value} onClick={() => setTypeFilter(value)}
              className="h-7 px-3 text-xs rounded-full transition-all duration-150"
              style={{
                background: active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                border: active ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.07)',
                color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
              }}>
              {label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="rounded-xl p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <TrendingUp className="w-7 h-7 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.25)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>No signals found</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Add companies or load demo data to see signals here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, daySignals]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span className="text-[10px] font-medium px-2 py-1 rounded-full"
                  style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {daySignals.map((signal) => (
                  <SignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
