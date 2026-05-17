export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { Sidebar } from '@/components/sidebar'
import { GeometricBackground } from '@/components/geometric-background'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Ambient geometric background — fewer shapes, lower opacity for app shell */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <GeometricBackground count={8} />
        {/* Subtle radial bloom */}
        <div className="absolute top-0 left-56 right-0 bottom-0"
          style={{ background: 'radial-gradient(ellipse at 60% 20%, rgba(168,85,247,0.04) 0%, transparent 60%)' }} />
      </div>

      <Sidebar user={session.user} />

      <main className="flex-1 overflow-y-auto relative z-10">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
