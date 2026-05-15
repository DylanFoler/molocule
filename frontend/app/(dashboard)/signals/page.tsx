'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Filter } from 'lucide-react'
import { SignalCard } from '@/components/signal-card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
      if (res.ok) {
        const data = await res.json()
        setSignals(data)
      }
      setLoading(false)
    }
    fetchSignals()
  }, [typeFilter])

  const grouped = signals.reduce<Record<string, Signal[]>>((acc, signal) => {
    const date = new Date(signal.detected_at).toDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(signal)
    return acc
  }, {})

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-violet-400" />
            Signal Feed
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {signals.length} signals detected across all companies
          </p>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        {FILTER_TYPES.map(({ value, label }) => (
          <Button
            key={value}
            variant={typeFilter === value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter(value)}
            className={cn(
              'h-7 text-xs rounded-full',
              typeFilter === value ? '' : 'border-border text-muted-foreground'
            )}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Signal timeline */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-violet-600/10 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-7 h-7 text-violet-400" />
          </div>
          <p className="text-sm font-medium text-foreground mb-2">No signals found</p>
          <p className="text-xs text-muted-foreground">
            Signals appear here after nightly scans detect changes for your tracked companies.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, daySignals]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px bg-border flex-1" />
                <span className="text-xs text-muted-foreground font-medium px-2 py-1 rounded-full bg-secondary">
                  {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <div className="h-px bg-border flex-1" />
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
