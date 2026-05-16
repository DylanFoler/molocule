'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, ArrowLeft, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import type { CompanyEnrichment } from '@/lib/types'
import { getFaviconUrl } from '@/lib/utils'

type Phase = 'input' | 'loading' | 'confirm'

interface CompanyFormProps {
  onSuccess?: () => void
}

export function CompanyForm({ onSuccess }: CompanyFormProps) {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [phase, setPhase]       = useState<Phase>('input')
  const [query, setQuery]       = useState('')
  const [enriched, setEnriched] = useState<CompanyEnrichment | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({
    name: '', website: '', linkedin_url: '', github_org: '', blog_rss_url: '',
  })

  function resetDialog() {
    setPhase('input')
    setQuery('')
    setEnriched(null)
    setForm({ name: '', website: '', linkedin_url: '', github_org: '', blog_rss_url: '' })
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) resetDialog()
  }

  async function handleLookup() {
    if (!query.trim()) return
    setPhase('loading')
    try {
      const res = await fetch('/api/companies/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: query }),
      })
      if (!res.ok) throw new Error()
      const data: CompanyEnrichment = await res.json()
      setEnriched(data)
      setForm({
        name:         data.name,
        website:      data.website,
        linkedin_url: data.linkedin_url ?? '',
        github_org:   data.github_org ?? '',
        blog_rss_url: data.blog_rss_url ?? '',
      })
      setPhase('confirm')
    } catch {
      toast({ title: 'Could not auto-fill', description: 'Enter details manually below.', variant: 'destructive' })
      setForm(f => ({ ...f, name: query, website: query.includes('.') ? `https://${query}` : '' }))
      setPhase('confirm')
    }
  }

  async function handleSave() {
    if (!form.name || !form.website) return
    setSaving(true)
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      const company = await res.json()
      setOpen(false)
      resetDialog()
      // If a callback is provided it handles refreshing; otherwise force a server re-fetch
      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
      }

      // Fire scan immediately so signals appear without waiting for nightly cron
      const scanningName = form.name
      toast({ title: 'Company added', description: `Scanning for recent signals on ${scanningName}...` })
      fetch(`/api/companies/${company.id}/scan`, { method: 'POST' })
        .then(r => r.json())
        .then(data => {
          const found = data?.signals_found ?? 0
          toast({
            title: found > 0 ? `${found} signal${found > 1 ? 's' : ''} found` : 'No recent signals',
            description: found > 0 ? `Signals detected for ${scanningName}.` : `We will keep watching ${scanningName} nightly.`,
          })
          if (onSuccess) { onSuccess() } else { router.refresh() }
        })
        .catch(() => {})
    } catch {
      toast({ title: 'Error', description: 'Failed to add company. Try again.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Track Company
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {phase === 'confirm' ? 'Confirm company' : 'Track a company'}
          </DialogTitle>
        </DialogHeader>

        {/* Phase: input */}
        {phase === 'input' && (
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="query">Company name or website</Label>
              <div className="flex gap-2">
                <Input
                  id="query"
                  placeholder="Stripe, stripe.com, ..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLookup()}
                  autoFocus
                />
                <Button onClick={handleLookup} disabled={!query.trim()} size="sm" className="px-3 shrink-0">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                We will auto-fetch the company info, GitHub org, and blog feed.
              </p>
            </div>
          </div>
        )}

        {/* Phase: loading */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'rgba(255,255,255,0.5)' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Looking up {query}...
            </p>
          </div>
        )}

        {/* Phase: confirm */}
        {phase === 'confirm' && (
          <div className="space-y-4 mt-2">
            {/* Favicon + description preview */}
            {enriched && (
              <div className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {enriched.favicon_url && (
                  <img src={enriched.favicon_url} alt="" className="w-8 h-8 rounded-lg object-contain"
                    style={{ border: '1px solid rgba(255,255,255,0.07)' }}
                    onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
                )}
                {enriched.description && (
                  <p className="text-[11px] leading-relaxed line-clamp-2"
                    style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {enriched.description}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="name">Company name *</Label>
              <Input id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="website">Website *</Label>
              <Input id="website" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="github_org" className="flex items-center gap-1.5">
                  GitHub org
                  {enriched && !enriched.found?.github && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ color: 'rgba(251,191,36,0.8)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>not found</span>
                  )}
                </Label>
                <Input id="github_org" placeholder={enriched && !enriched.found?.github ? 'Add GitHub org manually' : 'acme-inc'} value={form.github_org}
                  onChange={e => setForm(f => ({ ...f, github_org: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="linkedin_url" className="flex items-center gap-1.5">
                  LinkedIn URL
                  {enriched && !enriched.found?.linkedin && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ color: 'rgba(251,191,36,0.8)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>not found</span>
                  )}
                </Label>
                <Input id="linkedin_url" placeholder={enriched && !enriched.found?.linkedin ? 'Add LinkedIn URL manually' : 'linkedin.com/company/...'} value={form.linkedin_url}
                  onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="blog_rss_url" className="flex items-center gap-1.5">
                Blog RSS feed
                {enriched && !enriched.found?.rss && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ color: 'rgba(251,191,36,0.8)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>not found</span>
                )}
              </Label>
              <Input id="blog_rss_url" placeholder={enriched && !enriched.found?.rss ? 'Add RSS feed URL manually' : 'https://acme.com/blog/rss.xml'} value={form.blog_rss_url}
                onChange={e => setForm(f => ({ ...f, blog_rss_url: e.target.value }))} />
              {enriched && !enriched.found?.rss && (
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  No RSS feed detected. You can add one later by editing the company.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setPhase('input')}
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: 'rgba(255,255,255,0.35)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
                <ArrowLeft className="w-3 h-3" />
                Back
              </button>
              <Button onClick={handleSave} disabled={saving || !form.name || !form.website} size="sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Track Company
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
