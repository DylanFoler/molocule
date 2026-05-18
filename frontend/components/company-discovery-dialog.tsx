'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { getFaviconUrl } from '@/lib/utils'
import type { CompanySuggestion } from '@/app/api/companies/suggest/route'

interface CompanyDiscoveryDialogProps {
  onSuccess?: () => void
}

type FindPhase = 'idle' | 'finding' | 'done'

export function CompanyDiscoveryDialog({ onSuccess }: CompanyDiscoveryDialogProps) {
  const [open,        setOpen]        = useState(false)
  const [description, setDescription] = useState('')
  const [findPhase,   setFindPhase]   = useState<FindPhase>('idle')
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([])
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [tracking,    setTracking]    = useState(false)

  function reset() {
    setDescription('')
    setFindPhase('idle')
    setSuggestions([])
    setSelected(new Set())
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) reset()
  }

  function toggleSuggestion(name: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  async function handleFind() {
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
      toast({ title: 'Could not fetch suggestions', variant: 'destructive' })
      setFindPhase('idle')
    }
  }

  async function handleTrack() {
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
        const res = await fetch('/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:         enriched?.name         ?? s.name,
            website:      enriched?.website      ?? `https://${s.website}`,
            linkedin_url: enriched?.linkedin_url ?? null,
            github_org:   enriched?.github_org   ?? null,
            blog_rss_url: enriched?.blog_rss_url ?? null,
          }),
        })
        return res.ok
      } catch { return false }
    }))

    const added = results.filter(Boolean).length
    toast({
      title: `${added} ${added === 1 ? 'company' : 'companies'} added`,
      description: 'Signals will start appearing after the next nightly scan.',
    })
    setTracking(false)
    setOpen(false)
    reset()
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{ color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)')}>
          <Sparkles className="w-3.5 h-3.5" />
          Discover
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Discover companies to track</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Describe your market, competitors, or what you sell and we will suggest a starting list.
          </p>

          <div className="flex gap-2">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFind() } }}
              placeholder="e.g. I sell DevTools to engineering teams, main competitors are Linear and Notion..."
              rows={3}
              className="flex-1 resize-none rounded-lg px-3 py-2 text-[12px] outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'rgba(255,255,255,0.75)',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
            />
            <button
              onClick={handleFind}
              disabled={!description.trim() || findPhase === 'finding'}
              className="px-3 rounded-lg text-[11px] font-semibold transition-all shrink-0 self-stretch"
              style={{
                background: description.trim() ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: description.trim() ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)',
              }}>
              {findPhase === 'finding'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : 'Find'}
            </button>
          </div>

          {findPhase === 'done' && suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Select the ones you want to track:
              </p>
              <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
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
                        <p className="text-[11px] font-semibold truncate"
                          style={{ color: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)' }}>
                          {s.name}
                        </p>
                        <p className="text-[10px] leading-snug mt-0.5 line-clamp-2"
                          style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {s.reason}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {selected.size > 0 && (
                <button onClick={handleTrack} disabled={tracking}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-semibold transition-all mt-1"
                  style={{ background: 'rgba(255,255,255,0.88)', color: '#040404' }}>
                  {tracking
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding companies...</>
                    : `Track ${selected.size} ${selected.size === 1 ? 'company' : 'companies'}`}
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
