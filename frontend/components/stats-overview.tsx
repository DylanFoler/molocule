'use client'

import { Building2, Zap, TrendingUp } from 'lucide-react'
import type { DashboardStats } from '@/lib/types'

const statConfig = [
  { key: 'total_companies'   as const, label: 'Companies', icon: Building2  },
  { key: 'active_signals'    as const, label: 'Signals',   icon: Zap        },
  { key: 'new_signals_today' as const, label: 'New Today', icon: TrendingUp },
]

export function StatsOverview({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {statConfig.map(({ key, label, icon: Icon }, i) => (
        <div key={key}
          className="relative rounded-xl p-4 overflow-hidden cursor-default transition-all duration-300 group"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            animationDelay: `${i * 0.05}s`,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'
            ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.06)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'
            ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.03)'
          }}>

          {/* Corner fade */}
          <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: 'radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent)' }} />

          <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Icon className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.55)' }} />
          </div>

          <div className="text-2xl font-bold tabular-nums mb-0.5" style={{ color: 'rgba(255,255,255,0.88)' }}>
            {stats[key].toLocaleString()}
          </div>
          <div className="text-[10px] font-medium tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {label}
          </div>

          {/* Bottom hairline */}
          <div className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>
      ))}
    </div>
  )
}
