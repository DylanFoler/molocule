'use client'

import { signIn } from 'next-auth/react'
import { Github, Zap, GitPullRequest, TrendingUp, Shield } from 'lucide-react'
import { GeometricBackground } from '@/components/geometric-background'

const features = [
  { icon: TrendingUp, label: 'Buying Signals' },
  { icon: GitPullRequest, label: 'PR Digests' },
  { icon: Zap, label: 'AI Insights' },
  { icon: Shield, label: 'Change Detection' },
]

export function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center p-6"
      style={{ background: '#040404' }}>

      <GeometricBackground count={18} />

      {/* Very subtle center bloom */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.025) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-[340px]">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5 animate-float-slow"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 0 30px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}>
            <Zap className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.85)', filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.5))' }} />
          </div>

          <h1 className="text-[30px] font-bold tracking-tight leading-none mb-2">
            <span style={{
              background: 'linear-gradient(160deg, #ffffff 0%, rgba(255,255,255,0.55) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              molocule
            </span>
          </h1>
          <p className="text-[10px] tracking-[0.25em] uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>
            GTM Signal Intelligence
          </p>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-2 gap-1.5 mb-6">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Icon className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="relative rounded-xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.03) inset, 0 8px 32px rgba(0,0,0,0.6)',
          }}>

          {/* Top hairline */}
          <div className="absolute top-0 left-6 right-6 h-px"
            style={{ background: 'rgba(255,255,255,0.08)' }} />

          <div className="p-6">
            <p className="text-[13px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.88)' }}>Sign in to continue</p>
            <p className="text-[11px] leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.38)' }}>
              Connect GitHub to track buying signals and generate PR digests.
            </p>

            <button
              onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
              className="relative w-full h-10 rounded-lg overflow-hidden group transition-all duration-300 active:scale-[0.98]"
              style={{
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '0 0 20px rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.5)',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px rgba(255,255,255,0.15), 0 4px 16px rgba(0,0,0,0.5)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.5)')}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 shimmer-mono" />
              <div className="relative flex items-center justify-center gap-2 text-[13px] font-bold text-black">
                <Github className="w-4 h-4" />
                Continue with GitHub
              </div>
            </button>

            <p className="text-[10px] text-center mt-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Read-only repo access · No data sold
            </p>
          </div>
        </div>

        <p className="text-[10px] text-center mt-5 tracking-[0.18em] uppercase" style={{ color: 'rgba(255,255,255,0.15)' }}>
          Built for GTM &amp; full-stack engineers
        </p>
      </div>
    </div>
  )
}
