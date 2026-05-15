'use client'

import { useState, useEffect } from 'react'
import { GitPullRequest, Plus, Loader2, RefreshCw, Github } from 'lucide-react'
import { ReportCard } from '@/components/report-card'
import { PageHeader } from '@/components/page-header'
import { LoadDemoButton } from '@/components/load-demo-button'
import { toast } from '@/hooks/use-toast'
import type { Digest, Repo } from '@/lib/types'

const btn = {
  base: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
  muted: { color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' },
}

export default function ReportsPage() {
  const [repos,    setRepos]    = useState<Repo[]>([])
  const [digests,  setDigests]  = useState<Digest[]>([])
  const [loading,  setLoading]  = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [connecting,  setConnecting]  = useState(false)
  const [available,   setAvailable]   = useState<Array<{ id: number; full_name: string; owner: string; name: string }>>([])
  const [showPicker,  setShowPicker]  = useState(false)

  useEffect(() => {
    async function load() {
      const [rr, dr] = await Promise.all([fetch('/api/repos'), fetch('/api/reports')])
      if (rr.ok) setRepos(await rr.json())
      if (dr.ok) setDigests(await dr.json())
      setLoading(false)
    }
    load()
  }, [])

  async function fetchAvailable() {
    setConnecting(true)
    const res = await fetch('/api/github/repos')
    if (res.ok) { setAvailable(await res.json()); setShowPicker(true) }
    setConnecting(false)
  }

  async function connectRepo(repo: { id: number; full_name: string; owner: string; name: string }) {
    const res = await fetch('/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_repo_id: repo.id.toString(), owner: repo.owner, name: repo.name, full_name: repo.full_name }),
    })
    if (res.ok) {
      const newRepo = await res.json()
      setRepos(r => [...r, newRepo])
      setShowPicker(false)
      toast({ title: 'Repo connected', description: `${repo.full_name} is now connected.` })
    }
  }

  async function generateDigest(repoId: string) {
    setGenerating(repoId)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repoId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed')
      }
      const digest = await res.json()
      setDigests(d => [digest, ...d])
      toast({ title: 'Digest generated', description: 'Your PR digest is ready.' })
    } catch (e) {
      toast({ title: 'Error', description: String((e as Error).message), variant: 'destructive' })
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="space-y-6 animate-slide-up">

      <PageHeader
        title="Dev Digest"
        subtitle="Auto-generated PR summaries and engineering reports"
        right={
          <button onClick={fetchAvailable} disabled={connecting}
            className={btn.base} style={btn.muted}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)')}>
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Connect Repo
          </button>
        }
      />

      {/* Repo picker */}
      {showPicker && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>Select a repository</h3>
            <button onClick={() => setShowPicker(false)} style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>✕</button>
          </div>
          <div className="space-y-0.5 max-h-60 overflow-y-auto">
            {available
              .filter(r => !repos.find(c => c.github_repo_id === r.id.toString()))
              .map(repo => (
                <button key={repo.id} onClick={() => connectRepo(repo)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-colors"
                  style={{ color: 'rgba(255,255,255,0.65)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
                  <Github className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <span className="text-sm">{repo.full_name}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Connected repos */}
      {repos.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Connected Repositories
          </p>
          <div className="flex flex-wrap gap-2">
            {repos.map(repo => (
              <div key={repo.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                <Github className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{repo.full_name}</span>
                <button onClick={() => generateDigest(repo.id)} disabled={generating === repo.id}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors"
                  style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.07)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.88)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)')}>
                  {generating === repo.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <RefreshCw className="w-3 h-3" />}
                  Generate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Digests */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1].map(i => (
            <div key={i} className="h-48 rounded-xl animate-pulse"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
          ))}
        </div>
      ) : digests.length === 0 ? (
        <div className="rounded-xl p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <GitPullRequest className="w-7 h-7 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.25)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>No digests yet</p>
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Connect a repo and generate a digest, or load demo data to see how it looks.
          </p>
          <LoadDemoButton variant="compact" />
        </div>
      ) : (
        <div className="space-y-4">
          {digests.map(digest => <ReportCard key={digest.id} digest={digest} />)}
        </div>
      )}
    </div>
  )
}
