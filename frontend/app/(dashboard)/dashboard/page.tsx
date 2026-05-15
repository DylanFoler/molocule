import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createServiceClient } from '@/lib/supabase'
import { StatsOverview } from '@/components/stats-overview'
import { SignalCard } from '@/components/signal-card'
import { CompanyForm } from '@/components/company-form'
import { OnboardingPrompt } from '@/components/onboarding-prompt'
import type { Signal, DashboardStats } from '@/lib/types'
import { TrendingUp } from 'lucide-react'

async function getDashboardData(userId: string) {
  const supabase = createServiceClient()

  const [companiesRes, signalsRes, reposRes, digestsRes, recentSignalsRes, userRes] = await Promise.all([
    supabase.from('companies').select('id').eq('user_id', userId),
    supabase.from('signals').select('id, is_new, detected_at').eq('companies.user_id', userId),
    supabase.from('repos').select('id').eq('user_id', userId),
    supabase.from('digests').select('id').eq('repos.user_id', userId),
    supabase.from('signals').select('*, company:companies(*)').order('detected_at', { ascending: false }).limit(8),
    supabase.from('users').select('preferences').eq('id', userId).single(),
  ])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const stats: DashboardStats = {
    total_companies:   companiesRes.data?.length ?? 0,
    active_signals:    signalsRes.data?.length ?? 0,
    new_signals_today: signalsRes.data?.filter(s => new Date(s.detected_at) >= today).length ?? 0,
    connected_repos:   reposRes.data?.length ?? 0,
    digests_generated: digestsRes.data?.length ?? 0,
  }

  const preferences = (userRes.data as { preferences?: { company_types?: string[] } } | null)?.preferences ?? null

  return {
    stats,
    recentSignals: recentSignalsRes.data ?? [],
    showOnboarding: !preferences?.company_types?.length,
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const { stats, recentSignals, showOnboarding } = await getDashboardData(session!.user.id)

  return (
    <div className="space-y-7 animate-slide-up">

      {/* One-time setup prompt */}
      {showOnboarding && <OnboardingPrompt userId={session!.user.id} />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'rgba(255,255,255,0.88)' }}>
            Signal Overview
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <CompanyForm />
      </div>

      {/* Stats */}
      <StatsOverview stats={stats} />

      {/* Signal Feed */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>Recent Signals</h2>
            {stats.new_signals_today > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                {stats.new_signals_today} new
              </span>
            )}
          </div>
          <a href="/signals" className="text-xs transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={undefined} onMouseLeave={undefined}>
            View all →
          </a>
        </div>

        {recentSignals.length === 0 ? (
          <div className="rounded-xl p-10 text-center"
            style={{
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <TrendingUp className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.4)' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>No signals yet</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Add companies to start tracking signals.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {recentSignals.map((signal, i) => (
              <div key={signal.id} style={{ animationDelay: `${i * 0.04}s` }} className="animate-slide-up">
                <SignalCard signal={signal as Signal} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
