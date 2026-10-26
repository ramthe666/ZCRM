'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Plus, Download, Upload, ArrowRightCircle, MessageCircle, PhoneCall, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

import { api, formatMoney, personName, ACTIVITY_TYPES, type Row } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'
import {
  DataTable, TablePagination, SearchInput, PageHeader, RecordDialog, ConfirmDialog, DetailDrawer,
  ImportDialog, useDebounced, type FormFieldSpec,
} from '../shared'
import { ENTITY_CONFIGS, type EntityModuleConfig } from '../module-configs'

const ROLE_ORDER: Record<string, number> = { member: 1, manager: 2, admin: 3, owner: 4 }
const MIN_WRITE: Record<string, string> = { products: 'manager', templates: 'manager' }

interface OptionSources {
  members: { value: string; label: string }[]
  accounts: { value: string; label: string }[]
  contacts: { value: string; label: string }[]
  templates: { value: string; label: string }[]
}

export function EntityView({ entity, role }: { entity: string; role: string }) {
  const config: EntityModuleConfig = ENTITY_CONFIGS[entity]
  const store = useWorkspace()

  const [rows, setRows] = React.useState<Row[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [q, setQ] = React.useState('')
  const [filters, setFilters] = React.useState<Record<string, string>>({})
  const debouncedQ = useDebounced(q, 300)
  const pageSize = 25

  const [sources, setSources] = React.useState<OptionSources>({ members: [], accounts: [], contacts: [], templates: [] })

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Row | null>(null)
  const [deleting, setDeleting] = React.useState<Row | null>(null)
  const [drawerId, setDrawerId] = React.useState<string | null>(null)
  const [importOpen, setImportOpen] = React.useState(false)
  const [convertLead, setConvertLead] = React.useState<Row | null>(null)
  const [whatsappTo, setWhatsappTo] = React.useState<Row | null>(null)
  const [logFor, setLogFor] = React.useState<Row | null>(null)

  const canWrite = ROLE_ORDER[role] >= ROLE_ORDER[MIN_WRITE[entity] ?? 'member']
  const canDelete = ROLE_ORDER[role] >= ROLE_ORDER['manager']

  // Options for select fields
  React.useEffect(() => {
    let alive = true
    const needsMembers = config.formFields.some((f) => f.optionsFrom === 'members')
    const needsAccounts = config.formFields.some((f) => f.optionsFrom === 'accounts') || entity === 'deals'
    const needsContacts = config.formFields.some((f) => f.optionsFrom === 'contacts')
    const needsTemplates = config.formFields.some((f) => f.optionsFrom === 'templates')
    void Promise.all([
      needsMembers ? api<{ rows: Row[] }>('/api/org/members') : Promise.resolve(null),
      needsAccounts ? api<{ rows: Row[] }>('/api/data/accounts?pageSize=100') : Promise.resolve(null),
      needsContacts ? api<{ rows: Row[] }>('/api/data/contacts?pageSize=100') : Promise.resolve(null),
      needsTemplates ? api<{ rows: Row[] }>('/api/data/templates?pageSize=100') : Promise.resolve(null),
    ]).then(([members, accounts, contacts, templates]) => {
      if (!alive) return
      setSources({
        members: (members?.rows ?? []).map((m) => ({
          value: String((m.user as Row)?.id ?? ''),
          label: String((m.user as Row)?.name ?? 'Unknown'),
        })),
        accounts: (accounts?.rows ?? []).map((a) => ({ value: String(a.id), label: String(a.name) })),
        contacts: (contacts?.rows ?? []).map((c) => ({ value: String(c.id), label: personName(c) })),
        templates: (templates?.rows ?? []).map((t) => ({ value: String(t.id), label: String(t.name) })),
      })
    }).catch(() => {
      // Option sources are best-effort — record forms still work with free-text fallbacks.
      if (alive) setSources((s) => s)
    })
    return () => {
      alive = false
    }
  }, [config.formFields, entity])

  // List fetching
  const fetchList = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (debouncedQ) params.set('q', debouncedQ)
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v)
      const res = await api<{ rows: Row[]; total: number }>(`/api/data/${entity}?${params.toString()}`)
      setRows(res.rows)
      setTotal(res.total)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load records')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [entity, page, debouncedQ, filters])

  React.useEffect(() => {
    void fetchList()
  }, [fetchList, store.refreshTick])

  React.useEffect(() => {
    setPage(1)
  }, [debouncedQ, filters, entity])

  // Global "open record" (from search palette)
  React.useEffect(() => {
    if (store.openRecord && store.openRecord.entity === entity) {
      setDrawerId(store.openRecord.id)
    }
  }, [store.openRecord, entity])

  const submit = async (values: Record<string, string>) => {
    const payload: Record<string, unknown> = { ...values }
    if (editing) {
      await api(`/api/data/${entity}/${String(editing.id)}`, { method: 'PATCH', body: payload })
      toast.success(`${config.singular} updated`)
    } else {
      await api(`/api/data/${entity}`, { method: 'POST', body: payload })
      toast.success(`${config.singular} created`)
    }
    store.bump()
  }

  const handleDelete = async () => {
    if (!deleting) return
    await api(`/api/data/${entity}/${String(deleting.id)}`, { method: 'DELETE' })
    toast.success(`${config.singular} deleted`)
    setDrawerId(null)
    store.bump()
  }

  const drawerExtraActions = (record: Row) => (
    <>
      {entity === 'leads' && record.status !== 'converted' && (
        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setConvertLead(record)}>
          <ArrowRightCircle className="mr-1.5 h-3.5 w-3.5" /> Convert
        </Button>
      )}
      {entity === 'contacts' && (
        <Button size="sm" variant="outline" onClick={() => setWhatsappTo(record)}>
          <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => setLogFor(record)}>
        <PhoneCall className="mr-1.5 h-3.5 w-3.5" /> Log activity
      </Button>
    </>
  )

  const titleOf = (r: Row) => (entity === 'leads' || entity === 'contacts' ? personName(r) : String(r.name ?? r.title ?? 'Record'))

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <PageHeader title={config.title} description={config.description}>
        {config.exportable ? (
          <Button variant="outline" asChild>
            <a href={`/api/export?entity=${entity}`} download>
              <Download className="mr-1.5 h-4 w-4" /> Export CSV
            </a>
          </Button>
        ) : null}
        {config.importable ? (
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" /> Import
          </Button>
        ) : null}
        {canWrite ? (
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> New {config.singular}
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder={`Search ${config.title.toLowerCase()}…`} />
        {config.filters.map((f) => (
          <Select
            key={f.name}
            value={filters[f.name] ?? ''}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, [f.name]: v === '__all' ? '' : v }))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={`All ${f.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All</SelectItem>
              {(f.options ?? []).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        <span className="ml-auto hidden text-sm text-muted-foreground sm:block">
          {loading ? 'Loading…' : `${total} ${total === 1 ? config.singular.toLowerCase() : config.title.toLowerCase()}`}
        </span>
      </div>

      <DataTable
        columns={config.columns}
        rows={rows}
        loading={loading}
        onRowClick={(r) => setDrawerId(String(r.id))}
      />
      <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <RecordDialog
        title={editing ? `Edit ${config.singular}` : `New ${config.singular}`}
        description={editing ? undefined : `Add a new ${config.singular.toLowerCase()} to ${config.title.toLowerCase()}.`}
        fields={config.formFields}
        initial={editing}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={submit}
        sources={sources}
        submitLabel={editing ? 'Save changes' : `Create ${config.singular}`}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={`Delete ${config.singular.toLowerCase()}?`}
        description={`This will permanently delete "${deleting ? titleOf(deleting) : ''}".`}
      />

      <DetailDrawer
        entity={entity}
        recordId={drawerId}
        fields={config.formFields}
        titleOf={titleOf}
        onEdit={(r) => {
          setEditing(r)
          setDialogOpen(true)
        }}
        onDelete={(r) => setDeleting(r)}
        extraActions={canWrite || canDelete ? drawerExtraActions : undefined}
        onClose={() => {
          setDrawerId(null)
          store.clearOpenRecord()
        }}
      />

      {config.importable ? (
        <ImportDialog
          entity={entity as 'contacts' | 'leads'}
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onDone={() => store.bump()}
        />
      ) : null}

      <ConvertLeadDialog lead={convertLead} onClose={() => setConvertLead(null)} onDone={() => { setDrawerId(null); store.bump() }} />

      <WhatsAppDialog contact={whatsappTo} onClose={() => setWhatsappTo(null)} onDone={() => store.bump()} />

      <LogActivityDialog
        related={{ type: entity.replace(/s$/, ''), id: logFor ? String(logFor.id) : '' }}
        open={!!logFor}
        onClose={() => setLogFor(null)}
        onDone={() => store.bump()}
      />
    </motion.div>
  )
}

// ─────────────────────────── Lead conversion ───────────────────────────

function ConvertLeadDialog({ lead, onClose, onDone }: { lead: Row | null; onClose: () => void; onDone: () => void }) {
  const [dealName, setDealName] = React.useState('')
  const [dealAmount, setDealAmount] = React.useState('')
  const [createAccount, setCreateAccount] = React.useState(true)
  const [createDeal, setCreateDeal] = React.useState(true)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (lead) {
      const company = String(lead.company ?? '')
      setDealName(company ? `${company} — New Deal` : `${personName(lead)} — New Deal`)
      setDealAmount(String(lead.value ?? ''))
      setCreateAccount(Boolean(lead.company))
    }
  }, [lead])

  const run = async () => {
    if (!lead) return
    setBusy(true)
    try {
      const res = await api<{ deal: Row | null }>('/api/convert', {
        method: 'POST',
        body: {
          leadId: String(lead.id),
          createAccount,
          createDeal,
          dealName: dealName || undefined,
          dealAmount: dealAmount ? Number(dealAmount) : undefined,
        },
      })
      toast.success('Lead converted', { description: res.deal ? `Deal "${String(res.deal.name)}" created.` : 'Contact created.' })
      onDone()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Conversion failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert lead</DialogTitle>
          <DialogDescription>
            Creates a contact{lead?.company ? ' + account' : ''} and optionally an open deal, then marks the lead as converted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{lead ? personName(lead) : ''}</p>
            <p className="text-muted-foreground">{String(lead?.company ?? '—')} · {String(lead?.email ?? '—')}</p>
          </div>
          {lead?.company ? (
            <label className="flex items-center justify-between rounded-xl border p-3">
              <span className="text-sm">Create account “{String(lead.company)}”</span>
              <Switch checked={createAccount} onCheckedChange={setCreateAccount} />
            </label>
          ) : null}
          <label className="flex items-center justify-between rounded-xl border p-3">
            <span className="text-sm">Create a deal</span>
            <Switch checked={createDeal} onCheckedChange={setCreateDeal} />
          </label>
          {createDeal ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5">Deal name</Label>
                <Input value={dealName} onChange={(e) => setDealName(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5">Amount</Label>
                <Input type="number" value={dealAmount} onChange={(e) => setDealAmount(e.target.value)} placeholder="0" />
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={run} disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightCircle className="mr-2 h-4 w-4" />}
            Convert now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────── WhatsApp ───────────────────────────

function WhatsAppDialog({ contact, onClose, onDone }: { contact: Row | null; onClose: () => void; onDone: () => void }) {
  const [to, setTo] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (contact) {
      setTo(String(contact.phone ?? ''))
      setMessage(`Hi ${String(contact.firstName ?? '')}, following up on our conversation — do you have 15 minutes this week?`)
    }
  }, [contact])

  const run = async () => {
    setBusy(true)
    try {
      const res = await api<{ status: string; detail: string }>('/api/whatsapp', {
        method: 'POST',
        body: { to, message, contactId: contact ? String(contact.id) : undefined },
      })
      if (res.status === 'sent') toast.success('WhatsApp message sent')
      else if (res.status === 'simulated') toast.info('Message logged (demo mode)', { description: res.detail })
      else toast.warning('WhatsApp API error', { description: res.detail })
      onDone()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send WhatsApp message</DialogTitle>
          <DialogDescription>Delivered via WhatsApp Business API when connected in Settings → Integrations.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5">To (phone number)</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+1 555 000 1234" />
          </div>
          <div>
            <Label className="mb-1.5">Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={run} disabled={busy || !to || !message} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────── Log activity ───────────────────────────

export function LogActivityDialog({
  related,
  open,
  onClose,
  onDone,
}: {
  related?: { type: string; id: string }
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [type, setType] = React.useState('call')
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const [outcome, setOutcome] = React.useState('')
  const [duration, setDuration] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setType('call')
      setSubject('')
      setBody('')
      setOutcome('')
      setDuration('')
    }
  }, [open])

  const run = async () => {
    if (!subject.trim()) {
      toast.error('Subject is required')
      return
    }
    setBusy(true)
    try {
      await api('/api/data/activities', {
        method: 'POST',
        body: {
          type,
          subject,
          body: body || null,
          outcome: outcome || null,
          durationMin: duration ? Number(duration) : null,
          ...(related?.id ? { relatedType: related.type, relatedId: related.id } : {}),
        },
      })
      toast.success('Activity logged')
      onDone()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log activity')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log activity</DialogTitle>
          <DialogDescription>Calls, meetings, notes, emails and WhatsApp messages appear on the record timeline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {type === 'call' ? (
              <div>
                <Label className="mb-1.5">Outcome</Label>
                <Select value={outcome} onValueChange={(v) => setOutcome(v === '__none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {['connected', 'no_answer', 'left_voicemail', 'interested', 'not_interested'].map((o) => (
                      <SelectItem key={o} value={o}>{o.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="mb-1.5">Duration (min)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="—" />
              </div>
            )}
          </div>
          <div>
            <Label className="mb-1.5">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Discovery call with Ava" />
          </div>
          <div>
            <Label className="mb-1.5">Notes</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Key takeaways…" />
          </div>
          {related?.id ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked disabled className="pointer-events-none" />
              Linked to this {related.type} record
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={run} disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Log activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
