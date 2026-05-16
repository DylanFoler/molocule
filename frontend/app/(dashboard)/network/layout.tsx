import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Company Network - Molocule' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
