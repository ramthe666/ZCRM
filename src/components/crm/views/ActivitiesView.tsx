'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { format, isToday, isYesterday } from 'date-fns'
import { Phone, Plus, Mail, MessageCircle, CalendarClock, StickyNote, Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { api, ACTIVITY_TYPES, ACTIVITY_TONE, activityTypeLabel, type Row } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'
import { PageHeader, SearchInput, EmptyState, Avatar, StatusBadge, useDebounced } from '../shared'
import { LogActivityDialog } from './EntityView'

const ACTIVITY_ICON: Record<string, React.ElementType> = { note: StickyNote, call: Phone, meeting: CalendarClock, email: Mail, whatsapp: MessageCircle }

export function ActivitiesView() {
  const store = useWorkspace()
  const [rows, setRows] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(true)
  const [q, setQ] = React.useState('')
  const [type, setType] = React.useState('')
  const debouncedQ = useDebounced(q, 300)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    const params = new URLSearchParams({ pageSize: '100' })
    if (debouncedQ) params.set('q', debouncedQ)
    if (type) params.set('type', type)
    api<{ rows: Row[] }>(`/api/data/activities?${params.toString()}`)
      .then((r) => alive && setRows(r.rows))
      .catch(() => alive && toast.error('Failed to load activities'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [debouncedQ, type, store.refreshTick])

  // Group by day
  const groups = React.useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const a of rows) {
      const d = new Date(String(a.occurredAt ?? a.createdAt))
      const key = format(d, 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(a)
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [rows])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <PageHeader title="Activities" description="Every call, meeting, email, note and WhatsApp message across the team.">
        <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Log activity
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search activities…" />
        <Select value={type} onValueChange={(v) => setType(v === '__all' ? '' : v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All types</SelectItem>
            {ACTIVITY_TYPES.map((t) => (
              <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : groups.length === 0 ? (
        <EmptyState title="No activity yet" description="Log calls, meetings and notes from here or from any record drawer." />
      ) : (
        <div className="space-y-6">
          {groups.map(([day, items]) => {
            const d = new Date(day)
            const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, MMM d yyyy')
            return (
              <div key={day}>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{label}</h2>
                <div className="space-y-2">
                  {items.map((a) => {
                    const Icon = ACTIVITY_ICON[String(a.type)] ?? StickyNote
                    const user = a.user as Row | null
                    return (
                      <div key={String(a.id)} className="flex gap-3 rounded-2xl border bg-card p-4 shadow-sm">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-medium">{String(a.subject)}</p>
                            <div className="flex items-center gap-2">
                              {a.durationMin ? (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" /> {String(a.durationMin)}m
                                </span>
                              ) : null}
                              <StatusBadge label={activityTypeLabel(String(a.type))} tone={ACTIVITY_TONE[String(a.type)]} />
                            </div>
                          </div>
                          {a.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{String(a.body)}</p> : null}
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            {user ? (
                              <>
                                <Avatar name={String(user.name)} color={String(user.avatarColor)} size={18} />
                                {String(user.name)}
                              </>
                            ) : (
                              'System'
                            )}
                            <span>·</span>
                            <span>{format(new Date(String(a.occurredAt ?? a.createdAt)), 'p')}</span>
                            {a.outcome ? (
                              <>
                                <span>·</span>
                                <Badge variant="outline" className="capitalize">{String(a.outcome).replace(/_/g, ' ')}</Badge>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <LogActivityDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onDone={() => store.bump()} />
    </motion.div>
  )
}
