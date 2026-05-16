import Link from 'next/link'
import { MoleculeIcon } from '@/components/ui/molecule-icon'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4"
      style={{ background: '#040404' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <MoleculeIcon size={24} glowIntensity="subtle" />
      </div>
      <div>
        <p className="text-6xl font-bold mb-2 tabular-nums"
          style={{ color: 'rgba(255,255,255,0.08)' }}>404</p>
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Page not found
        </p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          This signal doesn&apos;t exist or has been removed.
        </p>
      </div>
      <Link href="/dashboard"
        className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
        Back to dashboard
      </Link>
    </div>
  )
}
