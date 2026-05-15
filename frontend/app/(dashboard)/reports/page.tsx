'use client'

import { useState, useEffect } from 'react'
import { GitPullRequest, Plus, Loader2, RefreshCw, Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportCard } from '@/components/report-card'
import { LoadDemoButton } from '@/components/load-demo-button'
import { toast } from '@/hooks/use-toast'
import type { Digest, Repo } from '@/lib/types'

export default function ReportsPage() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [digests, setDigests] = useState<Digest[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [availableRepos, setAvailableRepos] = useState<
    Array<{ id: number; full_name: string; owner: string; name: string }>
  >([])
  const [showRepoList, setShowRepoList] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const [reposRes, digestsRes] = await Promise.all([
        fetch('/api/repos'),
        fetch('/api/reports'),
      ])
      if (reposRes.ok) setRepos(await reposRes.json())
      if (digestsRes.ok) setDigests(await digestsRes.json())
      setLoading(false)
    }
    fetchData()
  }, [])

  async function fetchAvailableRepos() {
    setConnecting(true)
    const res = await fetch('/api/github/repos')
    if (res.ok) {
      setAvailableRepos(await res.json())
      setShowRepoList(true)
    }
    setConnecting(false)
  }

  async function connectRepo(repo: { id: number; full_name: string; owner: string; name: string }) {
    const res = await fetch('/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github_repo_id: repo.id.toString(),
        owner: repo.owner,
        name: repo.name,
        full_name: repo.full_name,
      }),
    })
    if (res.ok) {
      const newRepo = await res.json()
      setRepos((r) => [...r, newRepo])
      setShowRepoList(false)
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
      if (!res.ok) throw new Error()
      const digest = await res.json()
      setDigests((d) => [digest, ...d])
      toast({ title: 'Digest generated', description: 'Your PR digest is ready.' })
    } catch {
      toast({ title: 'Error', description: 'Failed to generate digest.', variant: 'destructive' })
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>Dev Digest</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Auto-generated PR summaries and engineering reports
          </p>
        </div>
        <Button onClick={fetchAvailableRepos} disabled={connecting} size="sm" className="gap-2">
          {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Connect Repo
        </Button>
      </div>

      {/* Repo picker */}
      {showRepoList && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Select a repository</h3>
            <button onClick={() => setShowRepoList(false)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {availableRepos
              .filter((r) => !repos.find((connected) => connected.github_repo_id === r.id.toString()))
              .map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => connectRepo(repo)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-secondary text-left transition-colors"
                >
                  <Github className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground">{repo.full_name}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Connected repos */}
      {repos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Connected Repositories</h2>
          <div className="flex flex-wrap gap-2">
            {repos.map((repo) => (
              <div key={repo.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card">
                <Github className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-foreground">{repo.full_name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => generateDigest(repo.id)}
                  disabled={generating === repo.id}
                  className="h-6 px-2 text-xs gap-1"
                >
                  {generating === repo.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  Generate
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Digests */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
          ))}
        </div>
      ) : digests.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <GitPullRequest className="w-7 h-7 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.25)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>No digests yet</p>
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Connect a GitHub repo and generate your first digest, or load demo data to see how it looks.
          </p>
          <LoadDemoButton variant="compact" />
        </div>
      ) : (
        <div className="space-y-4">
          {digests.map((digest) => (
            <ReportCard key={digest.id} digest={digest} />
          ))}
        </div>
      )}
    </div>
  )
}
