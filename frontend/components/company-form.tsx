'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'

interface CompanyFormProps {
  onSuccess?: () => void
}

export function CompanyForm({ onSuccess }: CompanyFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    website: '',
    linkedin_url: '',
    github_org: '',
    blog_rss_url: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.website) return

    setLoading(true)
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) throw new Error('Failed to add company')

      toast({ title: 'Company added', description: `${form.name} is now being tracked.` })
      setOpen(false)
      setForm({ name: '', website: '', linkedin_url: '', github_org: '', blog_rss_url: '' })
      onSuccess?.()
      router.refresh()
    } catch {
      toast({ title: 'Error', description: 'Failed to add company. Try again.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Company
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Track a company</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Company name *</Label>
            <Input
              id="name"
              placeholder="Acme Corp"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="website">Website *</Label>
            <Input
              id="website"
              placeholder="https://acme.com"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="github_org">GitHub org</Label>
              <Input
                id="github_org"
                placeholder="acme-inc"
                value={form.github_org}
                onChange={(e) => setForm((f) => ({ ...f, github_org: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                placeholder="linkedin.com/company/..."
                value={form.linkedin_url}
                onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="blog_rss_url">Blog RSS feed</Label>
            <Input
              id="blog_rss_url"
              placeholder="https://acme.com/blog/rss.xml"
              value={form.blog_rss_url}
              onChange={(e) => setForm((f) => ({ ...f, blog_rss_url: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Company
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
