'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import { LayoutDashboard, Building2, TrendingUp, Network, LogOut } from 'lucide-react'
import { MoleculeIcon } from '@/components/ui/molecule-icon'

interface SidebarProps {
  user?: { name?: string | null; email?: string | null; image?: string | null }
}

// Diamond layout: Overview (top), Companies (left), Signals (right), Network (bottom)
const NAV = [
  { href: '/dashboard', label: 'Overview',  Icon: LayoutDashboard, cx: 112, cy: 72  },
  { href: '/companies', label: 'Companies', Icon: Building2,        cx: 55,  cy: 148 },
  { href: '/signals',   label: 'Signals',   Icon: TrendingUp,       cx: 169, cy: 148 },
  { href: '/network',   label: 'Network',   Icon: Network,          cx: 112, cy: 224 },
]

const BONDS: [number, number][] = [
  [0, 1], [0, 2],  // Overview to Companies and Signals
  [1, 3], [2, 3],  // Companies and Signals to Network
  [1, 2],          // Companies to Signals cross bond
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-full relative"
      style={{ background: '#060606', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Top hairline */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* Logo */}
      <div className="h-14 flex items-center px-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <MoleculeIcon size={16} glowIntensity="subtle" />
          </div>
          <span className="font-bold text-[15px] tracking-tight" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.5))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            molocule
          </span>
        </Link>
      </div>

      {/* Molecule nav */}
      <div className="flex-1 flex flex-col items-center pt-4 pb-2">
        <svg width="224" height="270" viewBox="0 0 224 270">
          {/* Bond lines */}
          {BONDS.map(([i, j]) => {
            const a = NAV[i]; const b = NAV[j]
            const activeA = isActive(a.href); const activeB = isActive(b.href)
            const lit = activeA || activeB
            return (
              <line key={`${i}-${j}`}
                x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                stroke={lit ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}
                strokeWidth={lit ? 1.2 : 0.8}
                strokeDasharray={lit ? 'none' : '3,3'}
              />
            )
          })}

          {/* Nodes */}
          {NAV.map((item) => {
            const active = isActive(item.href)
            const r = item.href === '/dashboard' ? 22 : 18
            return (
              <Link key={item.href} href={item.href}>
                <g>
                  {/* Glow ring for active */}
                  {active && (
                    <circle cx={item.cx} cy={item.cy} r={r + 5}
                      fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                  )}

                  {/* Node circle */}
                  <circle cx={item.cx} cy={item.cy} r={r}
                    fill={active ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)'}
                    stroke={active ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)'}
                    strokeWidth={active ? 1.2 : 0.8}
                  />

                  {/* Active pulse dot */}
                  {active && (
                    <circle cx={item.cx + r - 4} cy={item.cy - r + 4} r={3}
                      fill="rgba(255,255,255,0.7)">
                      <animate attributeName="opacity" values="1;0.3;1" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Icon via foreignObject */}
                  <foreignObject
                    x={item.cx - 10} y={item.cy - 10}
                    width={20} height={20}
                    style={{ overflow: 'visible' }}>
                    <item.Icon
                      style={{
                        width: 16, height: 16,
                        color: active ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.35)',
                        filter: active ? 'drop-shadow(0 0 4px rgba(255,255,255,0.4))' : 'none',
                        marginLeft: 2, marginTop: 2,
                      }}
                    />
                  </foreignObject>

                  {/* Label */}
                  <text
                    x={item.cx} y={item.cy + r + 13}
                    textAnchor="middle"
                    fontSize={9}
                    fill={active ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.28)'}
                    fontFamily="system-ui, sans-serif"
                    fontWeight={active ? '600' : '400'}
                    letterSpacing="0.05em">
                    {item.label.toUpperCase()}
                  </text>
                </g>
              </Link>
            )
          })}
        </svg>
      </div>

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
          className="w-full mt-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all"
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
