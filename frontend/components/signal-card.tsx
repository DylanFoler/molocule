'use client'

import { ExternalLink, Sparkles } from 'lucide-react'
import { timeAgo, getFaviconUrl, truncate } from '@/lib/utils'
import { SIGNAL_LABELS } from '@/lib/types'
import type { Signal, SignalType } from '@/lib/types'

const TYPE_LABEL_OPACITY: Record<SignalType, number> = {
  FUNDING: 0.75, KEY_HIRE: 0.65, LAYOFF: 0.55, PRODUCT_LAUNCH: 0.7, GENERAL: 0.5,
}

export function SignalCard({ signal, showCompany = true }: { signal: Signal; showCompany?: boolean }) {
  const labelOpacity = TYPE_LABEL_OPACITY[signal.type] ?? 0.55

  return (
    <div className="relative rounded-xl overflow-hidden transition-all duration-300 group"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.03)'
      }}>

      {/* New signal — white left bar */}
      {signal.is_new && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5"
          style={{ background: 'rgba(255,255,255,0.6)', boxShadow: '0 0 6px rgba(255,255,255,0.4)' }} />
      )}

      {/* Pulse dot for new */}
      {signal.is_new && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
          </span>
        </div>
      )}

      <div className="p-4 pl-5">
        <div className="flex items-start gap-3">
          {showCompany && signal.company && (
            <div className="w-7 h-7 rounded-lg flex-shrink-0 overflow-hidden mt-0.5"
              style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
              <img src={getFaviconUrl(signal.company.website)} alt="" className="w-full h-full object-contain p-1"
                onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {showCompany && signal.company && (
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>{signal.company.name}</span>
              )}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase"
                style={{ color: `rgba(255,255,255,${labelOpacity})`, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {SIGNAL_LABELS[signal.type]}
              </span>
            </div>

            <p className="text-sm font-medium leading-snug mb-2" style={{ color: 'rgba(255,255,255,0.72)' }}>
              {truncate(signal.title, 100)}
            </p>

            {signal.llm_insight && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg mb-2"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Sparkles className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.5)', filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.3))' }} />
                <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {signal.llm_insight}
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{timeAgo(signal.detected_at)}</span>
              {signal.url && (
                <a href={signal.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] transition-colors"
                  style={{ color: 'rgba(255,255,255,0.28)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.28)')}>
                  <ExternalLink className="w-2.5 h-2.5" />
                  Source
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
