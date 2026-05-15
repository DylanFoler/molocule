'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { MoleculeIcon } from '@/components/ui/molecule-icon'
import { LoadDemoButton } from '@/components/load-demo-button'
import { toast } from '@/hooks/use-toast'
import type { CompanyType, SignalFocus } from '@/lib/types'

const COMPANY_TYPES: CompanyType[] = [
  'SaaS', 'FinTech', 'DevTools', 'E-commerce',
  'Healthcare', 'Enterprise', 'Crypto/Web3', 'Consumer',
]

const SIGNAL_FOCUSES: SignalFocus[] = [
  'Funding', 'Key Hires', 'Product Launches', 'Layoffs', 'All',
]

interface OnboardingPromptProps {
  userId: string
}

export function OnboardingPrompt({ userId: _userId }: OnboardingPromptProps) {
  const router = useRouter()
  const [selectedTypes, setSelectedTypes]   = useState<CompanyType[]>([])
  const [selectedSignals, setSelectedSignals] = useState<SignalFocus[]>([])
  const [saving, setSaving]   = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  function toggleType(t: CompanyType) {
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  function toggleSignal(s: SignalFocus) {
    if (s === 'All') {
      setSelectedSignals(prev => prev.includes('All') ? [] : ['All'])
      return
    }
    setSelectedSignals(prev =>
      prev.includes(s)
        ? prev.filter(x => x !== s && x !== 'All')
        : [...prev.filter(x => x !== 'All'), s]
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_types: selectedTypes, signal_focus: selectedSignals }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Preferences saved' })
      router.refresh()
    } catch {
      toast({ title: 'Could not save preferences', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  function handleSkip() {
    fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_types: ['SaaS'], signal_focus: ['All'] }),
    }).catch(() => {})
    setDismissed(true)
  }

  return (
    <div className="relative rounded-xl overflow-hidden mb-6 animate-slide-up"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>
      {/* Top hairline */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'rgba(255,255,255,0.08)' }} />

      {/* Dismiss */}
      <button onClick={handleSkip}
        className="absolute top-3 right-3 w-6 h-6 rounded-md flex items-center justify-center transition-colors"
        style={{ color: 'rgba(255,255,255,0.3)' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)')}>
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <MoleculeIcon size={18} glowIntensity="subtle" />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>
              Quick setup
            </p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
              Tell us what you are tracking so we can focus the right signals.
            </p>
          </div>
        </div>

        {/* Company types */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'rgba(255,255,255,0.4)' }}>
            Company types
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COMPANY_TYPES.map(type => {
              const active = selectedTypes.includes(type)
              return (
                <button key={type} onClick={() => toggleType(type)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150"
                  style={{
                    background:   active ? 'rgba(255,255,255,0.1)'  : 'rgba(255,255,255,0.03)',
                    border:       active ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.07)',
                    color:        active ? 'rgba(255,255,255,0.9)'  : 'rgba(255,255,255,0.45)',
                  }}>
                  {type}
                </button>
              )
            })}
          </div>
        </div>

        {/* Signal focus */}
        <div className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'rgba(255,255,255,0.4)' }}>
            Signals to watch
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SIGNAL_FOCUSES.map(sig => {
              const active = selectedSignals.includes(sig)
              return (
                <button key={sig} onClick={() => toggleSignal(sig)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150"
                  style={{
                    background:   active ? 'rgba(255,255,255,0.1)'  : 'rgba(255,255,255,0.03)',
                    border:       active ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.07)',
                    color:        active ? 'rgba(255,255,255,0.9)'  : 'rgba(255,255,255,0.45)',
                  }}>
                  {sig}
                </button>
              )
            })}
          </div>
        </div>

        {/* Demo data shortcut */}
        <div className="mb-4 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Want to see a full preview first?
          </p>
          <LoadDemoButton variant="compact" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.88)',
              color: '#040404',
              boxShadow: '0 0 12px rgba(255,255,255,0.06)',
            }}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Save preferences
          </button>
          <button onClick={handleSkip}
            className="px-3 py-2 rounded-lg text-[12px] transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
