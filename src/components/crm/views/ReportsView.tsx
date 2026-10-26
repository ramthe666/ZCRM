'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { Trophy, Target, Percent, DollarSign, Download } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

import { api, formatCompact, formatMoney, CHART_COLORS, type Row } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'
import { PageHeader, StatCard } from '../shared'

interface ReportsData {
  summary: {
    totalDeals: number
    totalWon: number
    totalLost: number
    winRate: number
    avgDealSize: number
    totalActivities: number
    totalLeads: number
    leadConversion: number
  }
  months: { month: string; label: string; createdValue: number; wonValue: number; createdCount: number; wonCount: number }[]
  byOwner: { name: string; won: number; pipeline: number; deals: number }[]
  funnel: { stage: string; count: number }[]
  leadsByStatus: { status: string; count: number }[]
  activitiesByType: { type: string; count: number }[]
  tasksByStatus: { status: string; count: number }[]
}

const stageLabel = (s: string) => ({ qualification: 'Qualification', needs_analysis: 'Needs Analysis', value_prop: 'Value Prop', negotiation: 'Negotiation', closed_won: 'Closed Won' })[s] ?? s

export function ReportsView() {
  const [data, setData] = React.useState<ReportsData | null>(null)
  const store = useWorkspace()

  React.useEffect(() => {
    let alive = true
    api<ReportsData>('/api/reports')
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
    return () => {
      alive = false
    }
  }, [store.refreshTick])

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }

  const exportCsv = () => {
    if (!data) return
    const rows = [
      ['Month', 'Created value', 'Created count', 'Won value', 'Won count'],
      ...data.months.map((m) => [m.label, String(m.createdValue), String(m.createdCount), String(m.wonValue), String(m.wonCount)]),
      [],
      ['Owner', 'Won', 'Pipeline', 'Deals'],
      ...data.byOwner.map((o) => [o.name, String(o.won), String(o.pipeline), String(o.deals)]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'nova-crm-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-5">
      <PageHeader title="Reports" description="Pipeline performance, conversion and team analytics.">
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-1.5 h-4 w-4" /> Export report
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total won" value={data.summary.totalWon} money icon={Trophy} tone="emerald" sub={`${data.summary.totalDeals} deals total`} />
        <StatCard label="Win rate" value={data.summary.winRate} suffix="%" icon={Target} tone="teal" sub="Won vs lost deals" />
        <StatCard label="Avg deal size" value={data.summary.avgDealSize} money icon={DollarSign} tone="amber" sub="Across all deals" />
        <StatCard label="Lead conversion" value={data.summary.leadConversion} suffix="%" icon={Percent} tone="orange" sub={`${data.summary.totalLeads} leads tracked`} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Created vs won — last 12 months</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="wonGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} width={54} />
              <Tooltip formatter={(value: number, name: string) => [formatMoney(value), name === 'createdValue' ? 'Created' : 'Won']} contentStyle={{ borderRadius: 12, border: '1px solid', fontSize: 13 }} />
              <Legend formatter={(v: string) => (v === 'createdValue' ? 'Created' : 'Won')} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="createdValue" stroke="#f59e0b" strokeWidth={2} fill="url(#createdGrad)" />
              <Area type="monotone" dataKey="wonValue" stroke="#10b981" strokeWidth={2.5} fill="url(#wonGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline funnel</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.funnel} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="stage" tickFormatter={(s: string) => stageLabel(s)} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} width={104} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid', fontSize: 13 }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {data.funnel.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activity mix</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {data.activitiesByType.every((a) => a.count === 0) ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No activity logged yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.activitiesByType.filter((a) => a.count > 0)} dataKey="count" nameKey="type" innerRadius={42} outerRadius={70} paddingAngle={3}>
                    {data.activitiesByType.filter((a) => a.count > 0).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid', fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sales by owner</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {data.byOwner.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No owned deals yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byOwner} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} tickFormatter={(n: string) => n.split(' ')[0]} />
                  <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} width={50} />
                  <Tooltip formatter={(value: number, name: string) => [formatMoney(value), name === 'won' ? 'Won' : 'Pipeline']} contentStyle={{ borderRadius: 12, border: '1px solid', fontSize: 13 }} />
                  <Legend formatter={(v: string) => (v === 'won' ? 'Won' : 'Open pipeline')} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="won" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="pipeline" stackId="a" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads by status</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.leadsByStatus} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} tickFormatter={(s: string) => s.replace(/_/g, ' ')} />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid', fontSize: 13 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.leadsByStatus.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tasks by status</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.tasksByStatus} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} tickFormatter={(s: string) => s.replace(/_/g, ' ')} />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid', fontSize: 13 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#14b8a6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
