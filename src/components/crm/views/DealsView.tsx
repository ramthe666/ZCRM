'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Plus, Columns3, Table as TableIcon, GripVertical } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { api, formatCompact, formatDate, formatMoney, personName, STAGES, stageLabel, STAGE_TONE, type Row } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'
import { PageHeader, DataTable, RecordDialog, DetailDrawer, ConfirmDialog, Avatar, StatusBadge, type ColumnSpec } from '../shared'
import { DEAL_FORM_FIELDS } from '../module-configs'
import { LogActivityDialog } from './EntityView'

const STAGE_DOT: Record<string, string> = {
  qualification: 'bg-slate-400',
  needs_analysis: 'bg-teal-500',
  value_prop: 'bg-amber-500',
  negotiation: 'bg-orange-500',
  closed_won: 'bg-emerald-500',
  closed_lost: 'bg-rose-500',
}

export function DealsView({ role }: { role: string }) {
  const store = useWorkspace()
  const [rows, setRows] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(true)
  const [view, setView] = React.useState<'kanban' | 'table'>('kanban')
  const [dragOver, setDragOver] = React.useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Row | null>(null)
  const [deleting, setDeleting] = React.useState<Row | null>(null)
  const [drawerId, setDrawerId] = React.useState<string | null>(null)
  const [logFor, setLogFor] = React.useState<Row | null>(null)

  const [members, setMembers] = React.useState<{ value: string; label: string }[]>([])
  const [accounts, setAccounts] = React.useState<{ value: string; label: string }[]>([])
  const [contacts, setContacts] = React.useState<{ value: string; label: string }[]>([])

  const fetchDeals = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ rows: Row[] }>('/api/data/deals?pageSize=100&sort=amount&order=desc')
      setRows(res.rows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load deals')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchDeals()
  }, [fetchDeals, store.refreshTick])

  React.useEffect(() => {
    if (store.openRecord?.entity === 'deals') setDrawerId(store.openRecord.id)
  }, [store.openRecord])

  React.useEffect(() => {
    let alive = true
    void Promise.all([
      api<{ rows: Row[] }>('/api/org/members'),
      api<{ rows: Row[] }>('/api/data/accounts?pageSize=100'),
      api<{ rows: Row[] }>('/api/data/contacts?pageSize=100'),
    ]).then(([m, a, c]) => {
      if (!alive) return
      setMembers(m.rows.map((x) => ({ value: String((x.user as Row)?.id ?? ''), label: String((x.user as Row)?.name ?? '') })))
      setAccounts(a.rows.map((x) => ({ value: String(x.id), label: String(x.name) })))
      setContacts(c.rows.map((x) => ({ value: String(x.id), label: personName(x) })))
    }).catch(() => {
      // Best-effort option lists — the deals table itself still loads.
    })
    return () => {
      alive = false
    }
  }, [])

  const moveDeal = async (dealId: string, stage: string) => {
    const deal = rows.find((r) => String(r.id) === dealId)
    if (!deal || deal.stage === stage) return
    const previous = deal.stage
    // Optimistic update
    setRows((prev) => prev.map((r) => (String(r.id) === dealId ? { ...r, stage } : r)))
    try {
      await api(`/api/data/deals/${dealId}`, { method: 'PATCH', body: { stage } })
      toast.success(`Moved to ${stageLabel(stage)}`, { description: String(deal.name) })
      store.bump()
    } catch (err) {
      setRows((prev) => prev.map((r) => (String(r.id) === dealId ? { ...r, stage: previous } : r)))
      toast.error(err instanceof Error ? err.message : 'Could not move deal')
    }
  }

  const submit = async (values: Record<string, string>) => {
    if (editing) {
      await api(`/api/data/deals/${String(editing.id)}`, { method: 'PATCH', body: values })
      toast.success('Deal updated')
    } else {
      await api('/api/data/deals', { method: 'POST', body: values })
      toast.success('Deal created')
    }
    store.bump()
  }

  const openPipeline = rows.filter((r) => !String(r.stage).startsWith('closed'))
  const pipelineValue = openPipeline.reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const weighted = openPipeline.reduce((s, r) => s + (Number(r.amount ?? 0) * Number(r.probability ?? 0)) / 100, 0)

  const columns: ColumnSpec[] = [
    { key: 'name', label: 'Deal', render: (r) => <span className="font-medium">{String(r.name)}</span> },
    { key: 'account', label: 'Account', mobileHidden: true, render: (r) => String((r.account as Row)?.name ?? '—') },
    { key: 'amount', label: 'Amount', render: (r) => <span className="tabular-nums font-medium">{formatMoney(r.amount)}</span> },
    { key: 'stage', label: 'Stage', render: (r) => <StatusBadge label={stageLabel(String(r.stage))} tone={STAGE_TONE[String(r.stage)]} /> },
    { key: 'probability', label: 'Win %', mobileHidden: true, render: (r) => `${Number(r.probability ?? 0)}%` },
    { key: 'expectedCloseAt', label: 'Close date', mobileHidden: true, render: (r) => (r.expectedCloseAt ? formatDate(r.expectedCloseAt) : '—') },
    { key: 'owner', label: 'Owner', mobileHidden: true, render: (r) => {
      const o = r.owner as Row | null
      return o ? (
        <span className="inline-flex items-center gap-1.5"><Avatar name={String(o.name)} color={String(o.avatarColor)} size={22} />{String(o.name)}</span>
      ) : '—'
    } },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <PageHeader title="Deals" description="Drag deals across stages. Probabilities and close dates update automatically.">
        <div className="flex items-center rounded-lg border p-0.5">
          <Button variant={view === 'kanban' ? 'secondary' : 'ghost'} size="sm" className="h-8" onClick={() => setView('kanban')}>
            <Columns3 className="mr-1.5 h-4 w-4" /> Board
          </Button>
          <Button variant={view === 'table' ? 'secondary' : 'ghost'} size="sm" className="h-8" onClick={() => setView('table')}>
            <TableIcon className="mr-1.5 h-4 w-4" /> Table
          </Button>
        </div>
        <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="mr-1.5 h-4 w-4" /> New deal
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {openPipeline.length} open deals
        </Badge>
        <Badge variant="outline" className="tabular-nums">Pipeline {formatCompact(pipelineValue)}</Badge>
        <Badge variant="outline" className="tabular-nums">Weighted forecast {formatCompact(weighted)}</Badge>
      </div>

      {view === 'table' ? (
        <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => setDrawerId(String(r.id))} />
      ) : (
        <div className="grid grid-cols-1 gap-3 overflow-x-auto pb-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {STAGES.map((stage) => {
            const stageDeals = rows.filter((r) => r.stage === stage.key)
            const total = stageDeals.reduce((s, r) => s + Number(r.amount ?? 0), 0)
            return (
              <div
                key={stage.key}
                className={`flex min-h-[220px] flex-col rounded-2xl border bg-muted/30 transition-colors ${dragOver === stage.key ? 'border-emerald-500/70 bg-emerald-500/5' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(stage.key)
                }}
                onDragLeave={() => setDragOver((prev) => (prev === stage.key ? null : prev))}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(null)
                  const id = e.dataTransfer.getData('text/deal-id')
                  if (id) void moveDeal(id, stage.key)
                }}
              >
                <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className={`h-2 w-2 rounded-full ${STAGE_DOT[stage.key]}`} />
                    {stage.label}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatCompact(total)}</span>
                </div>
                <p className="px-3 pb-2 text-xs text-muted-foreground">{stageDeals.length} deal{stageDeals.length === 1 ? '' : 's'}</p>
                <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3" style={{ maxHeight: 420 }}>
                  {stageDeals.map((deal) => {
                    const owner = deal.owner as Row | null
                    return (
                      <div
                        key={String(deal.id)}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/deal-id', String(deal.id))}
                        onClick={() => setDrawerId(String(deal.id))}
                        className="group cursor-pointer rounded-xl border bg-card p-3 shadow-sm transition hover:border-emerald-500/50 hover:shadow-md active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <p className="text-sm font-medium leading-snug">{String(deal.name)}</p>
                          <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 opacity-0 transition group-hover:opacity-100" />
                        </div>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatMoney(deal.amount)}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted-foreground">
                            {(deal.account as Row)?.name ?? (deal.contact as Row | null) ? personName((deal.contact as Row) ?? {}) : '—'}
                          </span>
                          {owner ? <Avatar name={String(owner.name)} color={String(owner.avatarColor)} size={20} /> : null}
                        </div>
                        {deal.expectedCloseAt ? (
                          <p className="mt-1.5 text-[11px] text-muted-foreground">Close: {formatDate(deal.expectedCloseAt)}</p>
                        ) : null}
                      </div>
                    )
                  })}
                  {stageDeals.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">Drop deals here</p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <RecordDialog
        title={editing ? 'Edit deal' : 'New deal'}
        fields={DEAL_FORM_FIELDS}
        initial={editing}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={submit}
        sources={{ members, accounts, contacts, templates: [] }}
        submitLabel={editing ? 'Save changes' : 'Create deal'}
      />

      <DetailDrawer
        entity="deals"
        recordId={drawerId}
        fields={DEAL_FORM_FIELDS}
        titleOf={(r) => String(r.name ?? 'Deal')}
        onEdit={(r) => { setEditing(r); setDialogOpen(true) }}
        onDelete={(r) => setDeleting(r)}
        extraActions={(r) => (
          <Button size="sm" variant="outline" onClick={() => setLogFor(r)}>
            Log activity
          </Button>
        )}
        onClose={() => { setDrawerId(null); store.clearOpenRecord() }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await api(`/api/data/deals/${String(deleting.id)}`, { method: 'DELETE' })
          toast.success('Deal deleted')
          setDrawerId(null)
          store.bump()
        }}
        title="Delete deal?"
        description={`This will permanently delete "${deleting ? String(deleting.name) : ''}".`}
      />

      <LogActivityDialog
        related={{ type: 'deal', id: logFor ? String(logFor.id) : '' }}
        open={!!logFor}
        onClose={() => setLogFor(null)}
        onDone={() => store.bump()}
      />
    </motion.div>
  )
}

export const DEAL_STAGE_META = STAGES
