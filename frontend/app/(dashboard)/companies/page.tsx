'use client'

import { useState, useEffect, useCallback } from 'react'
import { Building2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CompanyCard } from '@/components/company-card'
import { CompanyForm } from '@/components/company-form'
import { toast } from '@/hooks/use-toast'
import type { Company } from '@/lib/types'

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchCompanies = useCallback(async () => {
    const res = await fetch('/api/companies')
    if (res.ok) {
      const data = await res.json()
      setCompanies(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCompanies()
    const id = setInterval(fetchCompanies, 30_000)
    return () => clearInterval(id)
  }, [fetchCompanies])

  async function handleDelete(id: string) {
    const res = await fetch(`/api/companies?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCompanies((c) => c.filter((co) => co.id !== id))
      toast({ title: 'Company removed' })
    }
  }

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.website.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-violet-400" />
            Companies
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {companies.length} companies tracked
          </p>
        </div>
        <CompanyForm onSuccess={fetchCompanies} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-violet-600/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-violet-400" />
          </div>
          <p className="text-sm font-medium text-foreground mb-2">
            {search ? 'No companies match your search' : 'No companies yet'}
          </p>
          <p className="text-xs text-muted-foreground">
            {search
              ? 'Try a different search term.'
              : 'Add your first target company to start tracking buying signals.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((company) => (
            <CompanyCard key={company.id} company={company} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
