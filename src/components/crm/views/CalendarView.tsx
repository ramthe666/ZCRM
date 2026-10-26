'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, isToday, addMonths } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { api, TASK_STATUS, taskStatusLabel, TASK_TONE, type Row } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'
import { PageHeader, RecordDialog, StatusBadge, Avatar, EmptyState } from '../shared'
import { ENTITY_CONFIGS } from '../module-configs'

export function CalendarView() {
  const store = useWorkspace()
  const [cursor, setCursor] = React.useState(new Date())
  const [selected, setSelected] = React.useState(new Date())
  const [tasks, setTasks] = React.useState<Row[]>([])
  const [meetings, setMeetings] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(true)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [members, setMembers] = React.useState<{ value: string; label: string }[]>([])

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    void Promise.all([
      api<{ rows: Row[] }>('/api/data/tasks?pageSize=100'),
      api<{ rows: Row[] }>('/api/data/activities?type=meeting&pageSize=100'),
    ])
      .then(([t, m]) => {
        if (!alive) return
        setTasks(t.rows)
        setMeetings(m.rows)
      })
      .catch(() => toast.error('Failed to load calendar'))
      .finally(() => alive && setLoading(false))
    void api<{ rows: Row[] }>('/api/org/members').then((m) => {
      if (alive) setMembers(m.rows.map((x) => ({ value: String((x.user as Row)?.id ?? ''), label: String((x.user as Row)?.name ?? '') })))
    })
    return () => {
      alive = false
    }
  }, [store.refreshTick])

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [cursor])

  const tasksOn = (day: Date) => tasks.filter((t) => t.dueAt && isSameDay(new Date(String(t.dueAt)), day))
  const meetingsOn = (day: Date) => meetings.filter((m) => m.occurredAt && isSameDay(new Date(String(m.occurredAt)), day))

  const selectedTasks = tasksOn(selected)
  const selectedMeetings = meetingsOn(selected)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <PageHeader title="Calendar" description="Tasks by due date and scheduled meetings in one view.">
        <Button variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
        <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New task
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{format(cursor, 'MMMM yyyy')}</h2>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const dayTasks = tasksOn(day)
              const dayMeetings = meetingsOn(day)
              const inMonth = isSameMonth(day, cursor)
              const daySelected = isSameDay(day, selected)
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelected(day)}
                  className={`min-h-[72px] rounded-xl border p-1.5 text-left transition hover:border-emerald-500/60 ${
                    daySelected ? 'border-emerald-500 bg-emerald-500/5' : 'border-transparent'
                  } ${inMonth ? '' : 'opacity-40'} ${isToday(day) ? 'ring-1 ring-emerald-500/60' : ''}`}
                >
                  <span className={`text-xs font-medium ${isToday(day) ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                    {format(day, 'd')}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {dayMeetings.slice(0, 1).map((m) => (
                      <p key={String(m.id)} className="truncate rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                        {String(m.subject)}
                      </p>
                    ))}
                    {dayTasks.slice(0, 2).map((t) => (
                      <p key={String(t.id)} className={`truncate rounded px-1 py-0.5 text-[10px] ${t.status === 'completed' ? 'bg-muted text-muted-foreground line-through' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'}`}>
                        {String(t.title)}
                      </p>
                    ))}
                    {dayTasks.length + dayMeetings.length > 3 ? (
                      <p className="px-1 text-[10px] text-muted-foreground">+{dayTasks.length + dayMeetings.length - 3} more</p>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">{isToday(selected) ? 'Today' : format(selected, 'EEEE, MMM d')}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {selectedTasks.length} task{selectedTasks.length === 1 ? '' : 's'} · {selectedMeetings.length} meeting{selectedMeetings.length === 1 ? '' : 's'}
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : selectedTasks.length + selectedMeetings.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Nothing scheduled" description="Tasks with a due date and logged meetings appear here." />
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {selectedMeetings.map((m) => (
                <div key={String(m.id)} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{String(m.subject)}</p>
                    <Badge variant="outline" className="capitalize">meeting</Badge>
                  </div>
                  {m.body ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{String(m.body)}</p> : null}
                </div>
              ))}
              {selectedTasks.map((t) => (
                <div key={String(t.id)} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-medium ${t.status === 'completed' ? 'line-through opacity-60' : ''}`}>{String(t.title)}</p>
                    <StatusBadge label={taskStatusLabel(String(t.status))} tone={TASK_TONE[String(t.status)]} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Select value={String(t.status)} onValueChange={async (v) => {
                      try {
                        await api(`/api/data/tasks/${String(t.id)}`, { method: 'PATCH', body: { status: v } })
                        store.bump()
                        toast.success('Task updated')
                      } catch {
                        toast.error('Could not update task')
                      }
                    }}>
                      <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TASK_STATUS.map((s) => (
                          <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {t.assignee ? <Avatar name={String((t.assignee as Row).name)} color={String((t.assignee as Row).avatarColor)} size={20} /> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <RecordDialog
        title="New task"
        fields={ENTITY_CONFIGS.tasks.formFields}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (values) => {
          const payload = { ...values }
          if (values.dueAt) payload.dueAt = format(selected, 'yyyy-MM-dd')
          await api('/api/data/tasks', { method: 'POST', body: payload })
          toast.success('Task created')
          store.bump()
        }}
        sources={{ members, accounts: [], contacts: [], templates: [] }}
        submitLabel="Create task"
      />
    </motion.div>
  )
}

export const CALENDAR_ICON = CalendarDays
