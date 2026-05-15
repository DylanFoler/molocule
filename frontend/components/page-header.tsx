import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: string
  right?: ReactNode
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>
          {title}
        </h1>
        {/* Accent dash */}
        <div style={{
          width: 28,
          height: 1.5,
          marginTop: 6,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.2), transparent)',
          borderRadius: 99,
        }} />
        {subtitle && (
          <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}
