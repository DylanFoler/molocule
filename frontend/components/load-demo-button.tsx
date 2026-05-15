'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles, Trash2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export function LoadDemoButton({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)

  async function handleLoad() {
    setLoading(true)
    try {
      const res = await fetch('/api/demo/seed', { method: 'POST' })
      const data = await res.json()
      if (data.already_seeded) {
        toast({ title: 'Demo already loaded', description: 'Refreshing to show your data.' })
      } else {
        toast({
          title: `Demo loaded`,
          description: `${data.companies} companies, ${data.signals} signals, and 1 digest are ready.`,
        })
      }
      router.refresh()
    } catch {
      toast({ title: 'Could not load demo', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleClear() {
    setClearing(true)
    try {
      await fetch('/api/demo/seed', { method: 'DELETE' })
      toast({ title: 'Demo data cleared' })
      router.refresh()
    } catch {
      toast({ title: 'Could not clear demo', variant: 'destructive' })
    } finally {
      setClearing(false)
    }
  }

  if (variant === 'compact') {
    return (
      <button onClick={handleLoad} disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}>
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        Load demo
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleLoad} disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,0.88)', color: '#040404',
          boxShadow: '0 0 16px rgba(255,255,255,0.06)',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#ffffff')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.88)')}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? 'Loading demo...' : 'Load demo data'}
      </button>
      <button onClick={handleClear} disabled={clearing}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all"
        style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)')}>
        {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        Clear
      </button>
    </div>
  )
}
