'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X, Sparkles } from 'lucide-react'
import { MoleculeIcon } from '@/components/ui/molecule-icon'
import { LoadDemoButton } from '@/components/load-demo-button'
import { toast } from '@/hooks/use-toast'
import { getFaviconUrl } from '@/lib/utils'
import type { CompanyType, SignalFocus } from '@/lib/types'
import type { CompanySuggestion } from '@/app/api/companies/suggest/route'

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

type FindPhase = 'idle' | 'finding' | 'done'

export function OnboardingPrompt({ userId: _userId }: OnboardingPromptProps) {
  const router = useRouter()

  // Preferences state
  const [selectedTypes,   setSelectedTypes]   = useState<CompanyType[]>([])
  const [selectedSignals, setSelectedSignals] = useState<SignalFocus[]>([])
  const [saving,          setSaving]          = useState(false)
  const [dismissed,       setDismissed]       = useState(false)

  // Suggestion state
  const [description,   setDescription]   = useState('')
  const [findPhase,     setFindPhase]     = useState<FindPhase>('idle')
  const [suggestions,   setSuggestions]   = useState<CompanySuggestion[]>([])
  const [selected,      setSelected]      = useState<Set<string>>(new Set())
  const [tracking,      setTracking]      = useState(false)

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

  function toggleSuggestion(name: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  async function handleSavePrefs() {
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

  async function handleFindCompanies() {
    if (!description.trim()) return
    setFindPhase('finding')
    setSuggestions([])
    setSelected(new Set())
    try {
      const res = await fetch('/api/companies/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
      setFindPhase('done')
    } catch {
      toast({ title: 'Could not find suggestions', variant: 'destructive' })
      setFindPhase('idle')
    }
  }

  async function handleTrackSelected() {
    if (selected.size === 0) return
    setTracking(true)

    const toAdd = suggestions.filter(s => selected.has(s.name))

    const results = await Promise.all(toAdd.map(async s => {
      try {
        const enrichRes = await fetch('/api/companies/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: s.website }),
        })
        const enriched = enrichRes.ok ? await enrichRes.json() : null
        await fetch('/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:         enriched?.name        ?? s.name,
            website:      enriched?.website     ?? `https://${s.website}`,
            linkedin_url: enriched?.linkedin_url ?? null,
            github_org:   enriched?.github_org   ?? null,
            blog_rss_url: enriched?.blog_rss_url ?? null,
          }),
        })
        return true
      } catch { return false }
    }))

    // Save preferences at the same time
    await fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_types: selectedTypes.length ? selectedTypes : ['SaaS'], signal_focus: selectedSignals.length ? selectedSignals : ['All'] }),
    }).catch(() => {})

    const added = results.filter(Boolean).length
    toast({
      title: `${added} ${added === 1 ? 'company' : 'companies'} added`,
      description: 'Signals will start appearing after the next nightly scan.',
    })
    setTracking(false)
    router.refresh()
  }

  const pill = (active: boolean) => ({
    background: active ? 'rgba(255,255,255,0.1)'  : 'rgba(255,255,255,0.03)',
    border:     active ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.07)',
    color:      active ? 'rgba(255,255,255,0.9)'  : 'rgba(255,255,255,0.45)',
  })

  return (
    <div className="relative rounded-xl overflow-hidden mb-6 animate-slide-up"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

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
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>Quick setup</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
              Tell us what you are tracking so we can focus the right signals.
            </p>
          </div>
        </div>

        {/* Company types */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Company types
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COMPANY_TYPES.map(type => (
              <button key={type} onClick={() => toggleType(type)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150"
                style={pill(selectedTypes.includes(type))}>
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Signal focus */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Signals to watch
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SIGNAL_FOCUSES.map(sig => (
              <button key={sig} onClick={() => toggleSignal(sig)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150"
                style={pill(selectedSignals.includes(sig))}>
                {sig}
              </button>
            ))}
          </div>
        </div>

        {/* Demo shortcut */}
        <div className="mb-4 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Want to see a full preview first?</p>
          <LoadDemoButton variant="compact" />
        </div>

        {/* Company discovery */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Find companies to track
            </p>
          </div>
          <p className="text-[11px] mb-2.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Describe your market, competitors, or what you sell and we will suggest a starting list.
          </p>
          <div className="flex gap-2">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFindCompanies() } }}
              placeholder="e.g. I sell DevTools to engineering teams, main competitors are Linear and Notion..."
              rows={2}
              className="flex-1 resize-none rounded-lg px-3 py-2 text-[11px] outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'rgba(255,255,255,0.75)',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
            />
            <button
              onClick={handleFindCompanies}
              disabled={!description.trim() || findPhase === 'finding'}
              className="px-3 rounded-lg text-[11px] font-semibold transition-all shrink-0 self-stretch"
              style={{
                background: description.trim() ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: description.trim() ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)',
              }}>
              {findPhase === 'finding' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Find'}
            </button>
          </div>
        </div>

        {/* Suggestions */}
        {findPhase === 'done' && suggestions.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] mb-2.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Select the ones you want to track:
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {suggestions.map(s => {
                const isSelected = selected.has(s.name)
                return (
                  <button key={s.name} onClick={() => toggleSuggestion(s.name)}
                    className="flex items-start gap-2 p-2.5 rounded-lg text-left transition-all duration-150"
                    style={{
                      background: isSelected ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)',
                    }}>
                    <img src={getFaviconUrl(`https://${s.website}`)} alt=""
                      className="w-4 h-4 rounded mt-0.5 shrink-0 object-contain"
                      onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold truncate" style={{ color: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)' }}>
                        {s.name}
                      </p>
                      <p className="text-[10px] leading-snug mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {s.reason}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {selected.size > 0 && (
              <button onClick={handleTrackSelected} disabled={tracking}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-semibold transition-all"
                style={{ background: 'rgba(255,255,255,0.88)', color: '#040404' }}>
                {tracking
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding companies...</>
                  : `Track ${selected.size} ${selected.size === 1 ? 'company' : 'companies'}`}
              </button>
            )}
          </div>
        )}

        {/* Bottom actions */}
        <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={handleSavePrefs} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200 mt-3"
            style={{ background: 'rgba(255,255,255,0.88)', color: '#040404' }}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Save preferences
          </button>
          <button onClick={handleSkip}
            className="px-3 py-2 rounded-lg text-[12px] transition-colors mt-3"
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
