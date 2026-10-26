'use client'

import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from 'date-fns'

// ─────────────────────────── Types ───────────────────────────

export interface SessionUser {
  id: string
  email: string
  name: string
  title: string | null
  avatarColor: string
}

export interface OrgInfo {
  id: string
  name: string
  slug: string
  plan: string
  planStatus: string
  billingCycle: string
  currency: string
  trialEndsAt: string | null
  billingEmail: string | null
}

export interface MembershipInfo {
  role: string
  status: string
  org: OrgInfo
}

/** Pending org invitation surfaced on the session (join banner in the workspace). */
export interface PendingInvitation {
  token: string
  orgName: string
  role: string
  inviterName: string
  expiresAt: string
}

/** Resolved from a `?invite=<token>` deep link before any auth decision is made. */
export interface InviteContext {
  token: string
  email: string
  role: string
  orgName: string
  inviterName: string
}

export interface SessionPayload {
  user: SessionUser | null
  memberships?: MembershipInfo[]
  activeOrgId?: string
  pendingInvitations?: PendingInvitation[]
}

export type Row = Record<string, unknown>

/** Error thrown by the api() client — carries the HTTP status for flow control. */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// ─────────────────────────── API client ───────────────────────────

const ORG_KEY = 'nova-active-org'

export function getActiveOrgId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ORG_KEY)
}

export function setActiveOrgId(id: string) {
  if (typeof window !== 'undefined') window.localStorage.setItem(ORG_KEY, id)
}

export async function api<T = Row>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const orgId = getActiveOrgId()
  if (orgId) headers['X-Org-Id'] = orgId

  const res = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new ApiError((data.error as string) ?? `Request failed (${res.status})`, res.status)
  return data as T
}

// ─────────────────────────── Domain constants ───────────────────────────

export const STAGES = [
  { key: 'qualification', label: 'Qualification' },
  { key: 'needs_analysis', label: 'Needs Analysis' },
  { key: 'value_prop', label: 'Value Proposition' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'closed_won', label: 'Closed Won' },
  { key: 'closed_lost', label: 'Closed Lost' },
] as const

export const OPEN_STAGES = STAGES.slice(0, 4).map((s) => s.key)

export const LEAD_STATUSES = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'unqualified', label: 'Unqualified' },
  { key: 'converted', label: 'Converted' },
] as const

export const LIFECYCLE = [
  { key: 'lead', label: 'Lead' },
  { key: 'marketing_qualified', label: 'Marketing Qualified' },
  { key: 'sales_qualified', label: 'Sales Qualified' },
  { key: 'customer', label: 'Customer' },
  { key: 'evangelist', label: 'Evangelist' },
] as const

export const SOURCES = [
  { key: 'website', label: 'Website' },
  { key: 'referral', label: 'Referral' },
  { key: 'ads', label: 'Paid Ads' },
  { key: 'event', label: 'Event' },
  { key: 'cold_call', label: 'Cold Call' },
  { key: 'social', label: 'Social' },
  { key: 'partner', label: 'Partner' },
] as const

export const TASK_STATUS = [
  { key: 'not_started', label: 'Not Started' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'deferred', label: 'Deferred' },
] as const

export const PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'normal', label: 'Normal' },
  { key: 'high', label: 'High' },
  { key: 'urgent', label: 'Urgent' },
] as const

export const ACTIVITY_TYPES = [
  { key: 'note', label: 'Note' },
  { key: 'call', label: 'Call' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
] as const

export const SEGMENTS = [
  { key: 'all', label: 'All contacts' },
  { key: 'customers', label: 'Customers' },
  { key: 'prospects', label: 'Prospects' },
  { key: 'newsletter', label: 'Newsletter' },
] as const

export const ACCOUNT_TIERS = [
  { key: 'standard', label: 'Standard' },
  { key: 'silver', label: 'Silver' },
  { key: 'gold', label: 'Gold' },
  { key: 'platinum', label: 'Platinum' },
] as const

export const WORKFLOW_TRIGGERS = [
  { key: 'lead.created', label: 'Lead created' },
  { key: 'lead.status_changed', label: 'Lead status changed' },
  { key: 'contact.created', label: 'Contact created' },
  { key: 'deal.created', label: 'Deal created' },
  { key: 'deal.stage_changed', label: 'Deal stage changed' },
  { key: 'task.created', label: 'Task created' },
] as const

// ─────────────────────────── Label lookups ───────────────────────────

function lookup(list: readonly { key: string; label: string }[], key: string | null | undefined): string {
  if (!key) return '—'
  return list.find((i) => i.key === key)?.label ?? key.replace(/_/g, ' ')
}

export const stageLabel = (k: string) => lookup(STAGES, k)
export const leadStatusLabel = (k: string) => lookup(LEAD_STATUSES, k)
export const lifecycleLabel = (k: string) => lookup(LIFECYCLE, k)
export const sourceLabel = (k: string) => lookup(SOURCES, k)
export const taskStatusLabel = (k: string) => lookup(TASK_STATUS, k)
export const priorityLabel = (k: string) => lookup(PRIORITIES, k)
export const activityTypeLabel = (k: string) => lookup(ACTIVITY_TYPES, k)
export const tierLabel = (k: string) => lookup(ACCOUNT_TIERS, k)
export const roleLabel = (k: string) => ({ owner: 'Owner', admin: 'Admin', manager: 'Manager', member: 'Member' })[k] ?? k

// ─────────────────────────── Badge tones ───────────────────────────

export const TONES: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border-transparent',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border-transparent',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border-transparent',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300 border-transparent',
  rose: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 border-transparent',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300 border-transparent',
}

export const STAGE_TONE: Record<string, string> = {
  qualification: 'slate', needs_analysis: 'teal', value_prop: 'amber', negotiation: 'orange', closed_won: 'emerald', closed_lost: 'rose',
}
export const LEAD_TONE: Record<string, string> = {
  new: 'emerald', contacted: 'amber', qualified: 'teal', unqualified: 'slate', converted: 'emerald',
}
export const TASK_TONE: Record<string, string> = {
  not_started: 'slate', in_progress: 'amber', completed: 'emerald', deferred: 'rose',
}
export const PRIORITY_TONE: Record<string, string> = {
  low: 'slate', normal: 'teal', high: 'amber', urgent: 'rose',
}
export const LIFECYCLE_TONE: Record<string, string> = {
  lead: 'slate', marketing_qualified: 'amber', sales_qualified: 'teal', customer: 'emerald', evangelist: 'rose',
}
export const ACTIVITY_TONE: Record<string, string> = {
  note: 'slate', call: 'teal', meeting: 'amber', email: 'emerald', whatsapp: 'emerald',
}
export const ROLE_TONE: Record<string, string> = {
  owner: 'emerald', admin: 'teal', manager: 'amber', member: 'slate',
}
export const TIER_TONE: Record<string, string> = {
  standard: 'slate', silver: 'slate', gold: 'amber', platinum: 'teal',
}

// Chart palette — emerald family, no blue/indigo
export const CHART_COLORS = ['#10b981', '#14b8a6', '#f59e0b', '#f97316', '#f43f5e', '#94a3b8', '#84cc16', '#a3a3a3']

// ─────────────────────────── Formatting ───────────────────────────

export function formatMoney(value: unknown, currency = 'USD'): string {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

export function formatCompact(value: unknown): string {
  const n = Number(value ?? 0)
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return `$${n}`
}

export function formatDate(value: unknown): string {
  if (!value) return '—'
  try {
    return format(new Date(String(value)), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

export function formatDateTime(value: unknown): string {
  if (!value) return '—'
  try {
    return format(new Date(String(value)), 'MMM d, yyyy · h:mm a')
  } catch {
    return '—'
  }
}

export function formatRelative(value: unknown): string {
  if (!value) return '—'
  try {
    const d = new Date(String(value))
    if (isToday(d)) return 'Today'
    if (isTomorrow(d)) return 'Tomorrow'
    if (isYesterday(d)) return 'Yesterday'
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return '—'
  }
}

export function toDateInput(value: unknown): string {
  if (!value) return ''
  try {
    return format(new Date(String(value)), 'yyyy-MM-dd')
  } catch {
    return ''
  }
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

// ─────────────────────────── CSV ───────────────────────────

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, '')

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      cur.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      cur.push(field)
      field = ''
      if (cur.some((f) => f.trim() !== '')) rows.push(cur)
      cur = []
    } else field += c
  }
  cur.push(field)
  if (cur.some((f) => f.trim() !== '')) rows.push(cur)

  if (rows.length < 2) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? '').trim()
    })
    return obj
  })
}

export function personName(row: Row): string {
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || '—'
}

// ─────────────────────────── Sidebar modules ───────────────────────────

import {
  LayoutDashboard,
  UserPlus,
  Users,
  Building2,
  Target,
  Package,
  SquareCheckBig,
  CalendarDays,
  Activity,
  Megaphone,
  Mail,
  Zap,
  BarChart3,
  UsersRound,
  Blocks,
  CreditCard,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface ModuleDef {
  key: string
  label: string
  icon: LucideIcon
}

export const MODULE_GROUPS: { label: string; items: ModuleDef[] }[] = [
  { label: 'Home', items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Customers',
    items: [
      { key: 'leads', label: 'Leads', icon: UserPlus },
      { key: 'contacts', label: 'Contacts', icon: Users },
      { key: 'accounts', label: 'Accounts', icon: Building2 },
    ],
  },
  {
    label: 'Sales',
    items: [
      { key: 'deals', label: 'Deals', icon: Target },
      { key: 'products', label: 'Products', icon: Package },
    ],
  },
  {
    label: 'Work',
    items: [
      { key: 'tasks', label: 'Tasks', icon: SquareCheckBig },
      { key: 'calendar', label: 'Calendar', icon: CalendarDays },
      { key: 'activities', label: 'Activities', icon: Activity },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
      { key: 'templates', label: 'Email Templates', icon: Mail },
    ],
  },
  { label: 'Automation', items: [{ key: 'workflows', label: 'Workflows', icon: Zap }] },
  { label: 'Insights', items: [{ key: 'reports', label: 'Reports', icon: BarChart3 }] },
  {
    label: 'Manage',
    items: [
      { key: 'team', label: 'Team', icon: UsersRound },
      { key: 'integrations', label: 'Integrations', icon: Blocks },
      { key: 'billing', label: 'Billing & Plans', icon: CreditCard },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

export const ALL_MODULES: ModuleDef[] = MODULE_GROUPS.flatMap((g) => g.items)

// ─────────────────────────── Role-based module gating ───────────────────────────
// Mirrors the server-enforced role matrix: modules below require at least the
// given role. Everything else (dashboard, records, calendar, reports, team,
// settings…) is available to every role.
export const MODULE_MIN_ROLE: Record<string, 'manager' | 'admin'> = {
  campaigns: 'manager',
  workflows: 'manager',
  integrations: 'admin',
  billing: 'admin',
}

const ROLE_RANK: Record<string, number> = { member: 1, manager: 2, admin: 3, owner: 4 }

export function moduleAllowedForRole(moduleKey: string, role: string): boolean {
  const min = MODULE_MIN_ROLE[moduleKey]
  if (!min) return true
  return (ROLE_RANK[role] ?? 1) >= ROLE_RANK[min]
}

// ─────────────────────────── Invitations ───────────────────────────

export const INVITE_STATUS_TONE: Record<string, string> = {
  pending: 'amber',
  accepted: 'emerald',
  revoked: 'slate',
  expired: 'rose',
}

/** Slugs of the shared demo workspace (shown with the amber demo banner). */
export const DEMO_ORG_SLUGS = ['nimbus-works', 'nimbusworks']

export function isDemoOrg(org: { slug?: string | null } | null | undefined): boolean {
  return !!org?.slug && DEMO_ORG_SLUGS.includes(org.slug)
}
