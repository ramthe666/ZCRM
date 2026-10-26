'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Plus, Send, Eye, Loader2, Users, MousePointerClick, Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '../shared'

import { api, SEGMENTS, formatDate, type Row } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'
import { PageHeader, EmptyState } from '../shared'

const STATUS_TONE: Record<string, string> = { draft: 'amber', sent: 'emerald', sending: 'teal' }
const segmentLabel = (s: string) => SEGMENTS.find((x) => x.key === s)?.label ?? s

export function CampaignsView({ role }: { role: string }) {
  const store = useWorkspace()
  const [rows, setRows] = React.useState<Row[]>([])
  const [templates, setTemplates] = React.useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [templateId, setTemplateId] = React.useState('')
  const [segment, setSegment] = React.useState('all')
  const [busy, setBusy] = React.useState(false)
  const [sending, setSending] = React.useState<Row | null>(null)
  const [preview, setPreview] = React.useState<Row | null>(null)
  const [deleting, setDeleting] = React.useState<Row | null>(null)

  const canManage = ['manager', 'admin', 'owner'].includes(role)

  const fetchCampaigns = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ rows: Row[] }>('/api/data/campaigns?pageSize=50')
      setRows(res.rows)
    } catch {
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchCampaigns()
  }, [fetchCampaigns, store.refreshTick])

  React.useEffect(() => {
    void api<{ rows: Row[] }>('/api/data/templates?pageSize=100').then((r) =>
      setTemplates(r.rows.map((t) => ({ value: String(t.id), label: String(t.name) })))
    )
  }, [])

  const create = async () => {
    if (!name.trim()) {
      toast.error('Campaign name is required')
      return
    }
    setBusy(true)
    try {
      await api('/api/data/campaigns', { method: 'POST', body: { name, templateId: templateId || undefined, segment } })
      toast.success('Campaign created as draft')
      setDialogOpen(false)
      setName('')
      setTemplateId('')
      setSegment('all')
      store.bump()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create campaign')
    } finally {
      setBusy(false)
    }
  }

  const send = async () => {
    if (!sending) return
    setBusy(true)
    try {
      const res = await api<{ delivered: number; deliveryMode: string }>(`/api/campaigns/${String(sending.id)}/send`, { method: 'POST' })
      toast.success(`Campaign sent to ${res.delivered} contact${res.delivered === 1 ? '' : 's'}`, {
        description: res.deliveryMode === 'resend' ? 'Delivered via Resend.' : 'Demo mode — connect Resend in Integrations to deliver real email.',
      })
      setSending(null)
      store.bump()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <PageHeader title="Campaigns" description="Send email campaigns to contact segments using your templates.">
        {canManage ? (
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New campaign
          </Button>
        ) : null}
      </PageHeader>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create a campaign, pick a template and a segment, then send it to your contacts."
          action={canManage ? (
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> New campaign
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => {
            const template = c.template as Row | null
            const openRate = Number(c.sentCount ?? 0) > 0 ? Math.round((Number(c.openCount ?? 0) / Number(c.sentCount)) * 100) : 0
            return (
              <div key={String(c.id)} className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{String(c.name)}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {segmentLabel(String(c.segment))} · {template ? `Template: ${String(template.name)}` : 'No template'}
                    </p>
                  </div>
                  <Badge className={c.status === 'sent' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border-transparent' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border-transparent'} variant="outline">
                    {String(c.status)}
                  </Badge>
                </div>

                {c.status === 'sent' ? (
                  <>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-muted/50 p-2.5">
                        <p className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums">
                          <Inbox className="h-4 w-4 text-muted-foreground" />{String(c.sentCount)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">sent</p>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-2.5">
                        <p className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums">
                          <Users className="h-4 w-4 text-muted-foreground" />{String(c.openCount)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">opens</p>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-2.5">
                        <p className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums">
                          <MousePointerClick className="h-4 w-4 text-muted-foreground" />{String(c.clickCount)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">clicks</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {openRate}% open rate · sent {formatDate(c.sentAt)}
                    </p>
                  </>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                    Draft — recipients resolve at send time based on the segment.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2 pt-1">
                  {template ? (
                    <Button variant="outline" size="sm" onClick={() => setPreview(template)}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
                    </Button>
                  ) : null}
                  {canManage && c.status === 'draft' ? (
                    <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setSending(c)}>
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Send now
                    </Button>
                  ) : null}
                  {canManage && ['admin', 'owner'].includes(role) ? (
                    <Button variant="outline" size="sm" className="ml-auto text-rose-600 hover:text-rose-700" onClick={() => setDeleting(c)}>
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>Sent with your Resend integration when connected; otherwise delivered in demo mode.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5">Campaign name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="July product newsletter" />
            </div>
            <div>
              <Label className="mb-1.5">Template</Label>
              <Select value={templateId || undefined} onValueChange={(v) => setTemplateId(v === '__none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5">Segment</Label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!sending}
        onClose={() => setSending(null)}
        onConfirm={send}
        title="Send campaign now?"
        description={`Emails will go to every contact in the "${sending ? segmentLabel(String(sending.segment)) : ''}" segment. This cannot be undone.`}
        confirmLabel="Send campaign"
        destructive={false}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await api(`/api/data/campaigns/${String(deleting.id)}`, { method: 'DELETE' })
          toast.success('Campaign deleted')
          store.bump()
        }}
        title="Delete campaign?"
        description={`"${deleting ? String(deleting.name) : ''}" will be permanently deleted.`}
      />

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{preview ? String(preview.name) : ''}</DialogTitle>
            <DialogDescription>{preview ? String(preview.subject) : ''}</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/30 p-4 text-sm whitespace-pre-wrap">{preview ? String(preview.body) : ''}</div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
