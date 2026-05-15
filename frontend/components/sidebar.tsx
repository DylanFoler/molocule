'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import { LayoutDashboard, Building2, TrendingUp, GitPullRequest, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MoleculeIcon } from '@/components/ui/molecule-icon'

interface SidebarProps {
  user?: { name?: string | null; email?: string | null; image?: string | null }
}

const navItems = [
  { href: '/dashboard', label: 'Overview',   icon: LayoutDashboard },
  { href: '/companies', label: 'Companies',  icon: Building2 },
  { href: '/signals',   label: 'Signals',    icon: TrendingUp },
  { href: '/reports',   label: 'Dev Digest', icon: GitPullRequest },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-full relative"
      style={{
        background: '#060606',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>

      {/* Top hairline */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* Logo */}
      <div className="h-14 flex items-center px-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
            <MoleculeIcon size={16} glowIntensity="subtle" />
          </div>
          <span className="font-bold text-[15px] tracking-tight" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.5))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            molocule
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group"
              style={active ? {
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.9)',
              } : {
                border: '1px solid transparent',
                color: 'rgba(255,255,255,0.4)',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)' }}
            >
              {/* Active left accent */}
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.7)', boxShadow: '0 0 6px rgba(255,255,255,0.5)' }} />
              )}

              <Icon className="w-4 h-4"
                style={{ color: active ? 'rgba(255,255,255,0.85)' : 'inherit',
                  filter: active ? 'drop-shadow(0 0 4px rgba(255,255,255,0.4))' : 'none' }} />
              <span>{label}</span>

              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.7)', boxShadow: '0 0 5px rgba(255,255,255,0.6)', animation: 'pulse-ring 2.5s ease-in-out infinite' }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

      {/* User */}
      <div className="p-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          {user?.image ? (
            <div className="relative">
              <Image src={user.image} alt={user.name ?? 'User'} width={28} height={28} className="rounded-full" />
              <div className="absolute inset-0 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.15)' }} />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
              {user?.name?.[0] ?? 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{user?.name}</p>
            <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{user?.email}</p>
          </div>
        </div>

        <button onClick={() => signOut({ callbackUrl: '/' })}
          className="w-full mt-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200"
          style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid transparent' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
          }}>
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
