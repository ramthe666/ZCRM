'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2, Search, Upload, Inbox, ChevronLeft, ChevronRight, Pencil, Trash2, Phone, Mail, StickyNote, CalendarClock, MessageCircle, CheckCircle2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { api, parseCsv, formatDate, formatDateTime, formatRelative, initials, TONES, type Row } from '@/lib/crm'

// ─────────────────────────── Small primitives ───────────────────────────

export function Avatar({ name, color, size = 32 }: { name?: string | null; color?: string | null; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: color || '#059669', fontSize: Math.max(10, size * 0.38) }}
    >
      {initials(name)}
    </span>
  )
}

export function StatusBadge({ label, tone }: { label: string; tone?: string }) {
  return <Badge className={TONES[tone ?? 'slate'] ?? TONES.slate}>{label}</Badge>
}

export function CountUp({ value, prefix = '', suffix = '', duration = 700, money = false }: { value: number; prefix?: string; suffix?: string; duration?: number; money?: boolean }) {
  const [display, setDisplay] = React.useState(0)
  React.useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  const formatted = money
    ? display >= 1000
      ? `$${(display / 1000).toFixed(1).replace(/\.0$/, '')}K`
      : `$${display}`
    : display.toLocaleString('en-US')

  return (
    <span className="tabular-nums">
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'emerald',
  money,
  suffix = '',
}: {
  label: string
  value: number
  sub?: string
  icon: React.ElementType
  tone?: 'emerald' | 'teal' | 'amber' | 'rose' | 'orange'
  money?: boolean
  suffix?: string
}) {
  const toneBg: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border bg-card p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight">
            <CountUp value={value} money={money} />
            {suffix}
          </p>
          {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
        </div>
        <span className={`rounded-xl p-2.5 ${toneBg[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </motion.div>
  )
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

// Custom SVG empty-state illustration (no external assets)
export function EmptyIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden>
      <circle cx="100" cy="66" r="46" className="fill-emerald-500/5" />
      <circle cx="100" cy="66" r="46" className="stroke-emerald-500/30" strokeWidth="1.5" strokeDasharray="4 6" fill="none" />
      <rect x="66" y="46" width="68" height="44" rx="8" className="fill-background stroke-emerald-600/40" strokeWidth="2" />
      <path d="M66 58 h68" className="stroke-emerald-600/40" strokeWidth="2" />
      <circle cx="76" cy="52" r="2" className="fill-rose-400" />
      <circle cx="84" cy="52" r="2" className="fill-amber-400" />
      <circle cx="92" cy="52" r="2" className="fill-emerald-400" />
      <path d="M78 68 h30 M78 76 h44 M78 68 h30" className="stroke-muted-foreground/40" strokeWidth="3" strokeLinecap="round" />
      <circle cx="138" cy="88" r="14" className="fill-emerald-500/10 stroke-emerald-600/50" strokeWidth="2" />
      <path d="M147 97 l8 8" className="stroke-emerald-600/70" strokeWidth="3" strokeLinecap="round" />
      <circle cx="56" cy="34" r="3" className="fill-teal-400/60" />
      <circle cx="150" cy="40" r="2.5" className="fill-amber-400/60" />
      <circle cx="46" cy="100" r="2.5" className="fill-rose-400/50" />
    </svg>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <EmptyIllustration className="h-32 w-48" />
      <p className="mt-2 font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}

// ─────────────────────────── Table ───────────────────────────

export interface ColumnSpec {
  key: string
  label: string
  render?: (row: Row) => React.ReactNode
  className?: string
  mobileHidden?: boolean
}

export function DataTable({
  columns,
  rows,
  loading,
  onRowClick,
  empty,
}: {
  columns: ColumnSpec[]
  rows: Row[]
  loading?: boolean
  onRowClick?: (row: Row) => void
  empty?: React.ReactNode
}) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl border bg-card p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }
  if (rows.length === 0) {
    return <>{empty ?? <EmptyState title="Nothing here yet" description="Create your first record to get started." />}</>
  }
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <ScrollArea className="max-h-[65vh]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead key={c.key} className={c.mobileHidden ? 'hidden md:table-cell' : ''}>
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={String(row.id)}
                className={onRowClick ? 'cursor-pointer' : ''}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.mobileHidden ? 'hidden md:table-cell' : ''}>
                    {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  )
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {total.toLocaleString()} record{total === 1 ? '' : 's'} · page {page} of {pages}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
    </div>
  )
}

// ─────────────────────────── Forms ───────────────────────────

export interface FormFieldSpec {
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox'
  options?: { value: string; label: string }[]
  optionsFrom?: 'members' | 'accounts' | 'contacts' | 'templates'
  required?: boolean
  placeholder?: string
  full?: boolean
}

export function resolveOptions(field: FormFieldSpec, sources: { members: { value: string; label: string }[]; accounts: { value: string; label: string }[]; contacts: { value: string; label: string }[]; templates: { value: string; label: string }[] }): { value: string; label: string }[] {
  if (field.options) return field.options
  if (field.optionsFrom) return sources[field.optionsFrom] ?? []
  return []
}

export function FieldInput({
  field,
  value,
  onChange,
  sources,
}: {
  field: FormFieldSpec
  value: string
  onChange: (v: string) => void
  sources: { members: { value: string; label: string }[]; accounts: { value: string; label: string }[]; contacts: { value: string; label: string }[]; templates: { value: string; label: string }[] }
}) {
  const common = 'w-full'
  switch (field.type) {
    case 'textarea':
      return (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={common}
          rows={3}
        />
      )
    case 'select': {
      const options = resolveOptions(field, sources)
      const noneLabel = field.required ? 'Select…' : 'None'
      return (
        <Select value={value} onValueChange={(v) => onChange(v === '__none' ? '' : v)}>
          <SelectTrigger className={common}>
            <SelectValue placeholder={noneLabel} />
          </SelectTrigger>
          <SelectContent>
            {!field.required ? (
              <SelectItem value="__none">
                <span className="text-muted-foreground">{noneLabel}</span>
              </SelectItem>
            ) : null}
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    case 'checkbox':
      return (
        <div className="flex h-9 items-center">
          <Switch checked={value === 'true'} onCheckedChange={(c) => onChange(String(c))} aria-label={field.label} />
        </div>
      )
    default:
      return (
        <Input
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={common}
          required={field.required}
        />
      )
  }
}

export function RecordDialog({
  title,
  description,
  fields,
  initial,
  open,
  onClose,
  onSubmit,
  sources,
  submitLabel = 'Save',
}: {
  title: string
  description?: string
  fields: FormFieldSpec[]
  initial?: Row | null
  open: boolean
  onClose: () => void
  onSubmit: (values: Record<string, string>) => Promise<void>
  sources?: { members: { value: string; label: string }[]; accounts: { value: string; label: string }[]; contacts: { value: string; label: string }[]; templates: { value: string; label: string }[] }
  submitLabel?: string
}) {
  const emptySources = { members: [], accounts: [], contacts: [], templates: [] }
  const src = sources ?? emptySources
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      const v: Record<string, string> = {}
      for (const f of fields) {
        const raw = initial?.[f.name]
        if (f.type === 'date') v[f.name] = raw ? new Date(String(raw)).toISOString().slice(0, 10) : ''
        else if (f.type === 'checkbox') v[f.name] = raw === undefined || raw === null ? 'true' : String(raw)
        else v[f.name] = raw === null || raw === undefined ? '' : String(raw)
      }
      setValues(v)
    }
  }, [open, initial, fields])

  const set = (name: string) => (val: string) => setValues((prev) => ({ ...prev, [name]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    for (const f of fields) {
      if (f.required && !values[f.name]?.trim()) {
        toast.error(`"${f.label}" is required`)
        return
      }
    }
    setSubmitting(true)
    try {
      await onSubmit(values)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description ?? `Fill in the fields below to save this record.`}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.name} className={f.full ? 'sm:col-span-2' : ''}>
              <Label htmlFor={`field-${f.name}`} className="mb-1.5">
                {f.label}
                {f.required ? <span className="ml-0.5 text-rose-500">*</span> : null}
              </Label>
              <FieldInput field={f} value={values[f.name] ?? ''} onChange={set(f.name)} sources={src} />
            </div>
          ))}
          <div className="col-span-full flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  destructive = true,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
}) {
  const [loading, setLoading] = React.useState(false)
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? 'bg-rose-600 text-white hover:bg-rose-700' : ''}
            onClick={async (e) => {
              e.preventDefault()
              setLoading(true)
              try {
                await onConfirm()
                onClose()
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Something went wrong')
              } finally {
                setLoading(false)
              }
            }}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─────────────────────────── Import ───────────────────────────

export function ImportDialog({
  entity,
  open,
  onClose,
  onDone,
}: {
  entity: 'contacts' | 'leads'
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [text, setText] = React.useState('')
  const [importing, setImporting] = React.useState(false)
  const [result, setResult] = React.useState<{ inserted: number; failed: number; errors: { row: number; error: string }[] } | null>(null)

  const rows = React.useMemo(() => (text.trim() ? parseCsv(text) : []), [text])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const run = async () => {
    setImporting(true)
    try {
      const res = await api<{ inserted: number; failed: number; errors: { row: number; error: string }[] }>('/api/import', {
        method: 'POST',
        body: { entity, rows },
      })
      setResult(res)
      if (res.failed === 0) {
        toast.success(`Imported ${res.inserted} ${entity}`)
        onDone()
        setTimeout(() => {
          setResult(null)
          setText('')
          onClose()
        }, 1200)
      } else {
        onDone()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const sampleHeaders =
    entity === 'contacts' ? 'firstName,lastName,email,phone,title,company' : 'firstName,lastName,email,phone,company,title,source'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import {entity}</DialogTitle>
          <DialogDescription>Upload or paste CSV with headers. First row must be column names (e.g. <code className="text-xs">{sampleHeaders}</code>).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground transition hover:border-emerald-500/60 hover:text-foreground">
            <Upload className="h-4 w-4" />
            Choose a .csv file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="…or paste CSV here"
            rows={5}
            className="font-mono text-xs"
          />
          {rows.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Parsed <strong>{rows.length}</strong> rows · headers: {Object.keys(rows[0] ?? {}).join(', ') || '—'}
            </p>
          ) : null}
          {result ? (
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <p>
                ✅ Inserted <strong>{result.inserted}</strong> · ❌ Failed <strong>{result.failed}</strong>
              </p>
              {result.errors.length > 0 ? (
                <ScrollArea className="mt-2 max-h-32">
                  <ul className="space-y-1 text-xs text-rose-600 dark:text-rose-400">
                    {result.errors.map((e) => (
                      <li key={e.row}>
                        Row {e.row}: {e.error}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={run} disabled={rows.length === 0 || importing} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Import {rows.length || ''} rows
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────── Detail drawer ───────────────────────────

const ACTIVITY_ICON: Record<string, React.ElementType> = {
  note: StickyNote,
  call: Phone,
  meeting: CalendarClock,
  email: Mail,
  whatsapp: MessageCircle,
}

export function DetailDrawer({
  entity,
  recordId,
  fields,
  titleOf,
  onEdit,
  onDelete,
  extraActions,
  onClose,
}: {
  entity: string
  recordId: string | null
  fields: FormFieldSpec[]
  titleOf: (row: Row) => string
  onEdit: (row: Row) => void
  onDelete: (row: Row) => void
  extraActions?: (row: Row) => React.ReactNode
  onClose: () => void
}) {
  const [record, setRecord] = React.useState<Row | null>(null)
  const [loading, setLoading] = React.useState(false)
  const singular = entity.replace(/s$/, '').replace(/ie$/, 'y')

  const load = React.useCallback(async () => {
    if (!recordId) return
    setLoading(true)
    try {
      setRecord(await api<Row>(`/api/data/${entity}/${recordId}`))
    } catch {
      setRecord(null)
    } finally {
      setLoading(false)
    }
  }, [entity, recordId])

  React.useEffect(() => {
    void load()
  }, [load])

  const displayValue = (f: FormFieldSpec, row: Row): React.ReactNode => {
    const v = row[f.name]
    if (v === null || v === undefined || v === '') return <span className="text-muted-foreground">—</span>
    if (f.type === 'date') return formatDate(v)
    if (f.type === 'number') return String(v)
    if (f.type === 'textarea') return <span className="whitespace-pre-wrap">{String(v)}</span>
    if (f.options || f.optionsFrom) {
      const opts = f.options ?? []
      const found = opts.find((o) => o.value === String(v))
      return found ? <span className="font-medium">{found.label}</span> : String(v)
    }
    return String(v)
  }

  return (
    <Sheet open={!!recordId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="truncate">{loading ? 'Loading…' : record ? titleOf(record) : 'Record'}</SheetTitle>
          <SheetDescription className="capitalize">{singular} details</SheetDescription>
        </SheetHeader>

        {record ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap gap-2 border-b px-5 py-3">
              <Button size="sm" variant="outline" onClick={() => onEdit(record)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => onDelete(record)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
              {extraActions?.(record)}
            </div>

            <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-5 mt-3 w-fit">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="min-h-0 flex-1">
                <ScrollArea className="h-[calc(100vh-15rem)] px-5">
                  <dl className="space-y-3 py-3">
                    {fields.map((f) => (
                      <div key={f.name} className="flex flex-col gap-0.5 border-b pb-2.5 last:border-0 sm:flex-row sm:items-baseline sm:justify-between">
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                        <dd className="max-w-[60%] text-right text-sm">{displayValue(f, record)}</dd>
                      </div>
                    ))}
                  </dl>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="timeline" className="min-h-0 flex-1" asChild>
                <RelatedTimeline entity={entity} recordId={recordId ?? ''} />
              </TabsContent>
              <TabsContent value="tasks" className="min-h-0 flex-1" asChild>
                <RelatedTasks entity={entity} recordId={recordId ?? ''} />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <p className="text-sm text-muted-foreground">Record not found.</p>}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function RelatedTimeline({ entity, recordId }: { entity: string; recordId: string }) {
  const singular = entity.replace(/s$/, '')
  const [rows, setRows] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    api<{ rows: Row[] }>(`/api/data/activities?relatedType=${singular}&relatedId=${recordId}&pageSize=50`)
      .then((r) => alive && setRows(r.rows))
      .catch(() => alive && setRows([]))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [singular, recordId])

  if (loading) return <p className="p-5 text-sm text-muted-foreground">Loading…</p>
  if (rows.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
        <Inbox className="h-8 w-8 opacity-40" />
        No activity logged for this record yet.
      </div>
    )
  return (
    <ScrollArea className="h-[calc(100vh-15rem)] px-5">
      <ol className="relative space-y-4 py-4">
        <span className="absolute left-[11px] top-6 bottom-2 w-px bg-border" aria-hidden />
        {rows.map((a) => {
          const Icon = ACTIVITY_ICON[String(a.type)] ?? StickyNote
          return (
            <li key={String(a.id)} className="relative pl-8">
              <span className="absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{String(a.subject)}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(a.occurredAt)}</span>
              </div>
              {a.body ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{String(a.body)}</p> : null}
              <Badge variant="outline" className="mt-1.5 capitalize">
                {String(a.type)}
              </Badge>
            </li>
          )
        })}
      </ol>
    </ScrollArea>
  )
}

function RelatedTasks({ entity, recordId }: { entity: string; recordId: string }) {
  const singular = entity.replace(/s$/, '')
  const [rows, setRows] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    api<{ rows: Row[] }>(`/api/data/tasks?relatedType=${singular}&relatedId=${recordId}&pageSize=50`)
      .then((r) => alive && setRows(r.rows))
      .catch(() => alive && setRows([]))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [singular, recordId])

  if (loading) return <p className="p-5 text-sm text-muted-foreground">Loading…</p>
  if (rows.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
        <CheckCircle2 className="h-8 w-8 opacity-40" />
        No linked tasks.
      </div>
    )
  return (
    <ScrollArea className="h-[calc(100vh-15rem)] px-5">
      <ul className="space-y-2 py-4">
        {rows.map((t) => (
          <li key={String(t.id)} className="rounded-xl border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{String(t.title)}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{t.dueAt ? formatDateTime(t.dueAt) : 'No due date'}</span>
            </div>
            {t.description ? <p className="mt-0.5 text-xs text-muted-foreground">{String(t.description)}</p> : null}
          </li>
        ))}
      </ul>
    </ScrollArea>
  )
}

// ─────────────────────────── Misc ───────────────────────────

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export { X }
