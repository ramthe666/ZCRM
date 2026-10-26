'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Plus, Zap, Trash2, Loader2, ArrowRight, Workflow as WorkflowIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { api, WORKFLOW_TRIGGERS, formatRelative, type Row } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'
import { PageHeader, EmptyState, ConfirmDialog } from '../shared'

interface Condition { field: string; operator: string; value: string }
interface Action { type: string; config: Record<string, string> }

const TRIGGER_ENTITY_FIELDS: Record<string, { value: string; label: string; enum?: { value: string; label: string }[] }[]> = {
  lead: [
    { value: 'source', label: 'Source', enum: [{ value: 'website', label: 'Website' }, { value: 'referral', label: 'Referral' }, { value: 'ads', label: 'Paid Ads' }, { value: 'event', label: 'Event' }, { value: 'cold_call', label: 'Cold Call' }, { value: 'social', label: 'Social' }, { value: 'partner', label: 'Partner' }] },
    { value: 'status', label: 'Status', enum: [{ value: 'new', label: 'New' }, { value: 'contacted', label: 'Contacted' }, { value: 'qualified', label: 'Qualified' }, { value: 'unqualified', label: 'Unqualified' }, { value: 'converted', label: 'Converted' }] },
    { value: 'company', label: 'Company' },
    { value: 'value', label: 'Potential value' },
  ],
  deal: [
    { value: 'stage', label: 'Stage', enum: [{ value: 'qualification', label: 'Qualification' }, { value: 'needs_analysis', label: 'Needs Analysis' }, { value: 'value_prop', label: 'Value Proposition' }, { value: 'negotiation', label: 'Negotiation' }, { value: 'closed_won', label: 'Closed Won' }, { value: 'closed_lost', label: 'Closed Lost' }] },
    { value: 'source', label: 'Source' },
    { value: 'amount', label: 'Amount' },
    { value: 'name', label: 'Deal name' },
  ],
  contact: [
    { value: 'lifecycle', label: 'Lifecycle', enum: [{ value: 'lead', label: 'Lead' }, { value: 'marketing_qualified', label: 'MQL' }, { value: 'sales_qualified', label: 'SQL' }, { value: 'customer', label: 'Customer' }] },
    { value: 'source', label: 'Source' },
    { value: 'email', label: 'Email' },
  ],
  task: [
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'title', label: 'Title' },
  ],
}

const OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'ne', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
]

const ACTION_TYPES = [
  { value: 'create_task', label: 'Create follow-up task' },
  { value: 'notify', label: 'Notify the owner' },
  { value: 'send_email', label: 'Send email (logged)' },
  { value: 'update_field', label: 'Update a field' },
  { value: 'assign_owner', label: 'Re-assign owner' },
]

const ACTION_CONFIG: Record<string, { key: string; label: string; type: 'text' | 'number'; placeholder?: string; options?: { value: string; label: string }[] }[]> = {
  create_task: [
    { key: 'title', label: 'Task title', type: 'text', placeholder: 'Call {{name}} within 24h' },
    { key: 'dueInDays', label: 'Due in (days)', type: 'number', placeholder: '3' },
    { key: 'priority', label: 'Priority', type: 'text', options: [{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }] },
  ],
  notify: [
    { key: 'title', label: 'Notification title', type: 'text', placeholder: 'New lead: {{name}}' },
    { key: 'body', label: 'Notification body', type: 'text', placeholder: 'A new lead needs attention' },
  ],
  send_email: [
    { key: 'subject', label: 'Email subject', type: 'text', placeholder: 'Following up on {{name}}' },
    { key: 'body', label: 'Email body', type: 'text', placeholder: 'Hi {{name}}, …' },
  ],
  update_field: [
    { key: 'field', label: 'Field to update', type: 'text', placeholder: 'status' },
    { key: 'value', label: 'New value', type: 'text', placeholder: 'contacted' },
  ],
  assign_owner: [],
}

const ACTION_LABEL: Record<string, string> = {
  create_task: 'Create task',
  notify: 'Notify owner',
  send_email: 'Send email',
  update_field: 'Update field',
  assign_owner: 'Assign owner',
}

export function WorkflowsView({ role }: { role: string }) {
  const store = useWorkspace()
  const [rows, setRows] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Row | null>(null)
  const [deleting, setDeleting] = React.useState<Row | null>(null)

  const canManage = ['manager', 'admin', 'owner'].includes(role)

  const fetchRows = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ rows: Row[] }>('/api/data/workflows?pageSize=50')
      setRows(res.rows)
    } catch {
      toast.error('Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchRows()
  }, [fetchRows, store.refreshTick])

  const toggle = async (wf: Row) => {
    try {
      await api(`/api/data/workflows/${String(wf.id)}`, { method: 'PATCH', body: { active: !wf.active } })
      store.bump()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update workflow')
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <PageHeader title="Workflows" description="Automate follow-ups, alerts and field updates when records change.">
        {canManage ? (
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="mr-1.5 h-4 w-4" /> New workflow
          </Button>
        ) : null}
      </PageHeader>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No workflows yet"
          description="e.g. When a lead arrives from Paid Ads → create an urgent call task and notify its owner."
          action={canManage ? (
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { setEditing(null); setDialogOpen(true) }}>
              <Plus className="mr-1.5 h-4 w-4" /> New workflow
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((wf) => {
            let conditions: Condition[] = []
            let actions: Action[] = []
            try {
              conditions = JSON.parse(String(wf.conditions ?? '[]'))
              actions = JSON.parse(String(wf.actions ?? '[]'))
            } catch {
              /* ignore */
            }
            return (
              <div key={String(wf.id)} className={`flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition ${wf.active ? 'border-emerald-500/40' : 'opacity-80'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${wf.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                      <Zap className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <h3 className="font-semibold leading-tight">{String(wf.name)}</h3>
                      <p className="text-xs text-muted-foreground">{wf.lastRunAt ? `${String(wf.runCount)} runs · last ${formatRelative(wf.lastRunAt)}` : 'Never run'}</p>
                    </div>
                  </div>
                  {canManage ? (
                    <Switch checked={Boolean(wf.active)} onCheckedChange={() => toggle(wf)} aria-label="Toggle workflow" />
                  ) : null}
                </div>

                {wf.description ? <p className="mt-3 text-sm text-muted-foreground">{String(wf.description)}</p> : null}

                <div className="mt-4 space-y-2 text-sm">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <WorkflowIcon className="h-3.5 w-3.5" /> Trigger
                  </p>
                  <Badge variant="outline" className="capitalize">{WORKFLOW_TRIGGERS.find((t) => t.key === wf.trigger)?.label ?? String(wf.trigger)}</Badge>

                  {conditions.length > 0 ? (
                    <>
                      <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Conditions</p>
                      <div className="flex flex-wrap gap-1.5">
                        {conditions.map((c, i) => (
                          <Badge key={i} variant="secondary" className="font-normal">
                            {c.field} {OPERATORS.find((o) => o.value === c.operator)?.label ?? c.operator} “{c.value}”
                          </Badge>
                        ))}
                      </div>
                    </>
                  ) : null}

                  <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Actions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {actions.map((a, i) => (
                      <Badge key={i} className="border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                        {ACTION_LABEL[a.type] ?? a.type}
                      </Badge>
                    ))}
                  </div>
                </div>

                {canManage ? (
                  <div className="mt-4 flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(wf); setDialogOpen(true) }}>Edit</Button>
                    {['admin', 'owner'].includes(role) ? (
                      <Button variant="outline" size="sm" className="ml-auto text-rose-600 hover:text-rose-700" onClick={() => setDeleting(wf)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <WorkflowDialog
        open={dialogOpen}
        editing={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); store.bump() }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await api(`/api/data/workflows/${String(deleting.id)}`, { method: 'DELETE' })
          toast.success('Workflow deleted')
          store.bump()
        }}
        title="Delete workflow?"
        description={`"${deleting ? String(deleting.name) : ''}" will stop running immediately.`}
      />
    </motion.div>
  )
}

function WorkflowDialog({
  open, editing, onClose, onSaved,
}: {
  open: boolean
  editing: Row | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [trigger, setTrigger] = React.useState('lead.created')
  const [conditions, setConditions] = React.useState<Condition[]>([])
  const [actions, setActions] = React.useState<Action[]>([])
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      if (editing) {
        setName(String(editing.name ?? ''))
        setDescription(String(editing.description ?? ''))
        setTrigger(String(editing.trigger ?? 'lead.created'))
        try {
          setConditions(JSON.parse(String(editing.conditions ?? '[]')))
          setActions(JSON.parse(String(editing.actions ?? '[]')))
        } catch {
          setConditions([])
          setActions([])
        }
      } else {
        setName('')
        setDescription('')
        setTrigger('lead.created')
        setConditions([])
        setActions([{ type: 'create_task', config: { title: 'Follow up: {{name}}', dueInDays: '3', priority: 'normal' } }])
      }
    }
  }, [open, editing])

  const entity = trigger.split('.')[0]
  const entityFields = TRIGGER_ENTITY_FIELDS[entity] ?? []

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Workflow name is required')
      return
    }
    setBusy(true)
    try {
      const body = {
        name,
        description: description || null,
        trigger,
        conditions: JSON.stringify(conditions.filter((c) => c.field)),
        actions: JSON.stringify(actions),
        active: true,
      }
      if (editing) {
        await api(`/api/data/workflows/${String(editing.id)}`, { method: 'PATCH', body })
        toast.success('Workflow updated')
      } else {
        await api('/api/data/workflows', { method: 'POST', body })
        toast.success('Workflow created — it runs on matching events')
      }
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save workflow')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit workflow' : 'New workflow'}</DialogTitle>
          <DialogDescription>Trigger → conditions → actions. Use {'{{name}}'} placeholders in titles and bodies.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad lead follow-up" />
            </div>
            <div>
              <Label className="mb-1.5">Trigger</Label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORKFLOW_TRIGGERS.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1.5">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What does this automation do?" />
          </div>

          <div className="rounded-xl border p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label>Conditions (all must match)</Label>
              <Button variant="outline" size="sm" className="h-7" onClick={() => setConditions((c) => [...c, { field: entityFields[0]?.value ?? '', operator: 'eq', value: '' }])}>
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
            {conditions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No conditions — runs for every matching trigger event.</p>
            ) : (
              <div className="space-y-2">
                {conditions.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Select value={c.field} onValueChange={(v) => setConditions((prev) => prev.map((x, j) => (j === i ? { ...x, field: v } : x)))}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {entityFields.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={c.operator} onValueChange={(v) => setConditions((prev) => prev.map((x, j) => (j === i ? { ...x, operator: v } : x)))}>
                      <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {entityFields.find((f) => f.value === c.field)?.enum ? (
                      <Select value={c.value} onValueChange={(v) => setConditions((prev) => prev.map((x, j) => (j === i ? { ...x, value: v } : x)))}>
                        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Value" /></SelectTrigger>
                        <SelectContent>
                          {entityFields.find((f) => f.value === c.field)?.enum?.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input className="w-[130px]" value={c.value} onChange={(e) => setConditions((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="Value" />
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => setConditions((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove condition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label>Actions</Label>
              <Button variant="outline" size="sm" className="h-7" onClick={() => setActions((a) => [...a, { type: 'create_task', config: {} }])}>
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
            <div className="space-y-3">
              {actions.map((a, i) => (
                <div key={i} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Select value={a.type} onValueChange={(v) => setActions((prev) => prev.map((x, j) => (j === i ? { type: v, config: {} } : x)))}>
                      <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => setActions((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove action">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {ACTION_CONFIG[a.type]?.length ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {ACTION_CONFIG[a.type].map((f) => (
                        <div key={f.key}>
                          <Label className="mb-1 text-xs">{f.label}</Label>
                          {f.options ? (
                            <Select value={a.config[f.key] ?? ''} onValueChange={(v) => setActions((prev) => prev.map((x, j) => (j === i ? { ...x, config: { ...x.config, [f.key]: v } } : x)))}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                {f.options.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              className="h-8"
                              type={f.type === 'number' ? 'number' : 'text'}
                              value={a.config[f.key] ?? ''}
                              placeholder={f.placeholder}
                              onChange={(e) => setActions((prev) => prev.map((x, j) => (j === i ? { ...x, config: { ...x.config, [f.key]: e.target.value } } : x)))}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : a.type === 'assign_owner' ? (
                    <p className="mt-2 text-xs text-muted-foreground">Re-assigns the record to the user who triggered the automation context (owner field).</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
            <ArrowRight className="h-3.5 w-3.5 text-emerald-600" />
            Preview: <strong className="font-medium">{WORKFLOW_TRIGGERS.find((t) => t.key === trigger)?.label}</strong>
            {conditions.length > 0 ? <> + {conditions.length} condition{conditions.length === 1 ? '' : 's'}</> : null}
            {' → '}
            {actions.map((a) => ACTION_LABEL[a.type] ?? a.type).join(' + ') || 'no actions yet'}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editing ? 'Save workflow' : 'Create workflow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
