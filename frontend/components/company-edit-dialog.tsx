'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import type { Company } from '@/lib/types'

interface Props {
  company: Company
  open: boolean
  onClose: () => void
  onSaved: (updated: Company) => void
}

export function CompanyEditDialog({ company, open, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:         company.name,
    website:      company.website,
    linkedin_url: company.linkedin_url ?? '',
    github_org:   company.github_org ?? '',
    blog_rss_url: company.blog_rss_url ?? '',
  })

  async function handleSave() {
    if (!form.name || !form.website) return
    setSaving(true)
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      const updated: Company = await res.json()
      toast({ title: 'Company updated' })
      onSaved(updated)
      onClose()
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Edit {company.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Company name *</Label>
            <Input id="edit-name" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-website">Website *</Label>
            <Input id="edit-website" value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-github">GitHub org</Label>
              <Input id="edit-github" placeholder="acme-inc" value={form.github_org}
                onChange={e => setForm(f => ({ ...f, github_org: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-linkedin">LinkedIn URL</Label>
              <Input id="edit-linkedin" placeholder="linkedin.com/company/..." value={form.linkedin_url}
                onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-rss">Blog RSS feed</Label>
            <Input id="edit-rss" placeholder="https://acme.com/blog/rss.xml" value={form.blog_rss_url}
              onChange={e => setForm(f => ({ ...f, blog_rss_url: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.name || !form.website}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
