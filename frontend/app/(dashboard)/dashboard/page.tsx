export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'
import { StatsOverview } from '@/components/stats-overview'
import { SignalCard } from '@/components/signal-card'
import { CompanyForm } from '@/components/company-form'
import { LoadDemoButton } from '@/components/load-demo-button'
import { AutoRefresh } from '@/components/auto-refresh'
import { PageHeader } from '@/components/page-header'
import { NetworkTeaser } from '@/components/network-teaser'
import type { Signal, DashboardStats } from '@/lib/types'
import { OnboardingPrompt } from '@/components/onboarding-prompt'
import { TrendingUp } from 'lucide-react'

async function getDashboardData(userId: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [companies, recentSignalsRaw, allSignalMeta] = await Promise.all([
    prisma.company.findMany({ where: { user_id: userId }, select: { id: true } }),
    prisma.signal.findMany({
      where: { company: { user_id: userId } },
      include: { company: true },
      orderBy: { detected_at: 'desc' },
      take: 8,
    }),
    prisma.signal.findMany({
      where: { company: { user_id: userId } },
      select: { id: true, detected_at: true },
    }),
  ])

  const stats: DashboardStats = {
    total_companies: companies.length,
    active_signals: allSignalMeta.length,
    new_signals_today: allSignalMeta.filter(s => s.detected_at >= today).length,
  }

  const recentSignals = recentSignalsRaw.map(s => ({
    ...s,
    detected_at: s.detected_at.toISOString(),
    created_at: s.created_at.toISOString(),
    company: s.company ? {
      ...s.company,
      created_at: s.company.created_at.toISOString(),
      updated_at: s.company.updated_at.toISOString(),
    } : undefined,
  }))

  return { stats, recentSignals }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const { stats, recentSignals } = await getDashboardData(session!.user.id)
  const isEmpty = stats.total_companies === 0

  return (
    <div className="space-y-7 animate-slide-up">
      <AutoRefresh intervalMs={30_000} />

      <PageHeader
        title="Signal Overview"
        subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        right={<CompanyForm />}
      />

      {isEmpty && <OnboardingPrompt userId={session!.user.id} />}

      {isEmpty && (
        <div className="rounded-xl p-8 flex items-center justify-between gap-6"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.82)' }}>
              No companies tracked yet
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Add a company or load demo data to see the full experience.
            </p>
          </div>
          <div className="flex-shrink-0">
            <LoadDemoButton variant="full" />
          </div>
        </div>
      )}

      <StatsOverview stats={stats} />

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>
              Recent Signals
            </h2>
            {stats.new_signals_today > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                {stats.new_signals_today} new
              </span>
            )}
          </div>
          <a href="/signals" className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            View all →
          </a>
        </div>

        {recentSignals.length === 0 ? (
          <div className="rounded-xl p-10 text-center"
            style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <TrendingUp className="w-6 h-6 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
            <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>No signals yet</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Add companies to start tracking, or load demo data above.
            </p>
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

      {stats.total_companies > 1 && (
        <NetworkTeaser companyCount={stats.total_companies} />
      )}
    </div>
  )
}
