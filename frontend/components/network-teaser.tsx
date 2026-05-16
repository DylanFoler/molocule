'use client'

import { Network } from 'lucide-react'

export function NetworkTeaser({ companyCount }: { companyCount: number }) {
  return (
    <a href="/network"
      className="flex items-center justify-between p-4 rounded-xl transition-all"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)')}>
      <div className="flex items-center gap-3">
        <Network className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
        <div>
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>Company Network</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            See how your {companyCount} tracked companies connect
          </p>
        </div>
      </div>
      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Open →</span>
    </a>
  )
}
