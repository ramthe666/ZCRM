'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
  PieChart, Pie, Cell,
} from 'recharts'
import { Target, Trophy, TrendingUp, UserPlus, SquareCheckBig, Phone, Mail, MessageCircle, CalendarClock, StickyNote, ArrowRight } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

import { api, formatCompact, formatMoney, formatRelative, stageLabel, STAGES, CHART_COLORS, type Row } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'
import { StatCard, Avatar } from '../shared'

interface DashboardData {
  kpis: {
    pipelineValue: number
    openDeals: number
    wonRevenue: number
    winRate: number
    newLeads30: number
    totalLeads: number
    contacts: number
    accounts: number
    openTasks: number
    dueSoonTasks: number
  }
  revenueByMonth: { month: string; label: string; amount: number; count: number }[]
  pipelineByStage: { stage: string; count: number; amount: number }[]
  leadsBySource: { source: string; count: number }[]
  recentActivities: Row[]
  upcomingTasks: Row[]
  topDeals: Row[]
}

const ACTIVITY_ICON: Record<string, React.ElementType> = { note: StickyNote, call: Phone, meeting: CalendarClock, email: Mail, whatsapp: MessageCircle }

export function DashboardView({ userName }: { userName: string }) {
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const store = useWorkspace()

  React.useEffect(() => {
    let alive = true
    api<DashboardData>('/api/dashboard')
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
    return () => {
      alive = false
    }
  }, [store.refreshTick])

  if (error) return <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  const { kpis } = data
  const openPipeline = data.pipelineByStage.filter((s) => !s.stage.startsWith('closed'))
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {userName.split(' ')[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what&apos;s happening across your pipeline today.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Open pipeline" value={kpis.pipelineValue} money icon={Target} tone="emerald" sub={`${kpis.openDeals} active deals`} />
        <StatCard label="Won revenue" value={kpis.wonRevenue} money icon={Trophy} tone="teal" sub="All closed-won" />
        <StatCard label="Win rate" value={kpis.winRate} suffix="%" icon={TrendingUp} tone="amber" sub="Won vs lost" />
        <StatCard label="New leads (30d)" value={kpis.newLeads30} icon={UserPlus} tone="orange" sub={`${kpis.totalLeads} total`} />
        <StatCard label="Open tasks" value={kpis.openTasks} icon={SquareCheckBig} tone="rose" sub={`${kpis.dueSoonTasks} due within 7 days`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue — closed won</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} width={54} />
                <Tooltip
                  formatter={(value: number) => [formatMoney(value), 'Revenue']}
                  contentStyle={{ borderRadius: 12, border: '1px solid', fontSize: 13 }}
                />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline by stage</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={openPipeline} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" horizontal={false} />
                <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="stage" tickFormatter={(s: string) => stageLabel(s)} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} width={108} />
                <Tooltip formatter={(value: number, name: string) => (name === 'amount' ? [formatMoney(value), 'Value'] : [value, 'Deals'])} contentStyle={{ borderRadius: 12, border: '1px solid', fontSize: 13 }} />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                  {openPipeline.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads by source (90d)</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {data.leadsBySource.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No recent leads</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.leadsBySource} dataKey="count" nameKey="source" innerRadius={45} outerRadius={72} paddingAngle={3}>
                    {data.leadsBySource.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid', fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Upcoming tasks</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-700 dark:text-emerald-400" onClick={() => store.setModule('tasks')}>
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-56">
              {data.upcomingTasks.length === 0 ? (
                <p className="flex h-32 items-center justify-center text-sm text-muted-foreground">Nothing due — enjoy the calm 🌿</p>
              ) : (
                <ul className="space-y-2.5">
                  {data.upcomingTasks.map((t) => (
                    <li key={String(t.id)} className="flex items-start justify-between gap-2 text-sm">
                      <div>
                        <p className="font-medium leading-tight">{String(t.title)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t.dueAt ? formatRelative(t.dueAt) : 'No due date'}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 capitalize">{String(t.priority)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Top open deals</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-700 dark:text-emerald-400" onClick={() => store.setModule('deals')}>
              Pipeline <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-56">
              <ul className="space-y-2.5">
                {data.topDeals.map((d) => (
                  <li key={String(d.id)} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-tight">{String(d.name)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{stageLabel(String(d.stage))}</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{formatMoney(d.amount)}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentActivities.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No activity yet — log calls and notes from any record.</p>
          ) : (
            <ScrollArea className="max-h-72">
              <ol className="relative space-y-4 pl-1">
                <span className="absolute left-[15px] top-2 bottom-2 w-px bg-border" aria-hidden />
                {data.recentActivities.map((a) => {
                  const Icon = ACTIVITY_ICON[String(a.type)] ?? StickyNote
                  const user = a.user as Row | null
                  return (
                    <li key={String(a.id)} className="relative flex items-start gap-3 pl-8">
                      <span className="absolute left-1 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{String(a.subject)}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          {user ? <Avatar name={String(user.name)} color={String(user.avatarColor)} size={16} /> : null}
                          {user ? String(user.name) : 'System'} · {formatRelative(a.occurredAt)}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 capitalize">{String(a.type)}</Badge>
                    </li>
                  )
                })}
              </ol>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export const DASHBOARD_STAGE_ORDER = STAGES
