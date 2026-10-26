import { db } from '@/lib/db'
import { errorResponse, json, requireAuth } from '@/lib/auth'

// Aggregated KPIs + chart series for the workspace dashboard.
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    const orgId = auth.org.id

    const [deals, leads, contacts, accounts, tasks, activities] = await Promise.all([
      db.deal.findMany({
        where: { orgId },
        select: { id: true, name: true, amount: true, stage: true, probability: true, createdAt: true, closedAt: true, expectedCloseAt: true, ownerId: true, accountId: true },
      }),
      db.lead.findMany({ where: { orgId }, select: { id: true, source: true, status: true, value: true, createdAt: true } }),
      db.contact.count({ where: { orgId } }),
      db.account.count({ where: { orgId } }),
      db.task.findMany({
        where: { orgId, status: { not: 'completed' } },
        select: { id: true, title: true, priority: true, dueAt: true, status: true, assigneeId: true },
        orderBy: { dueAt: 'asc' },
        take: 6,
      }),
      db.activity.findMany({
        where: { orgId },
        include: { user: { select: { id: true, name: true, avatarColor: true } } },
        orderBy: { occurredAt: 'desc' },
        take: 8,
      }),
    ])

    const OPEN_STAGES = ['qualification', 'needs_analysis', 'value_prop', 'negotiation']
    const now = Date.now()
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const openDeals = deals.filter((d) => OPEN_STAGES.includes(d.stage))
    const wonDeals = deals.filter((d) => d.stage === 'closed_won')
    const lostDeals = deals.filter((d) => d.stage === 'closed_lost')

    // Revenue trend — last 6 months of closed-won
    const revenueByMonth: { month: string; label: string; amount: number; count: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      revenueByMonth.push({
        month: monthKey(d),
        label: d.toLocaleString('en-US', { month: 'short' }),
        amount: 0,
        count: 0,
      })
    }
    for (const deal of wonDeals) {
      if (!deal.closedAt) continue
      const bucket = revenueByMonth.find((m) => m.month === monthKey(deal.closedAt as Date))
      if (bucket) {
        bucket.amount += deal.amount
        bucket.count += 1
      }
    }

    // Pipeline by stage
    const stageOrder = ['qualification', 'needs_analysis', 'value_prop', 'negotiation', 'closed_won', 'closed_lost']
    const pipelineByStage = stageOrder.map((stage) => {
      const list = deals.filter((d) => d.stage === stage)
      return { stage, count: list.length, amount: list.reduce((s, d) => s + d.amount, 0) }
    })

    // Leads by source (last 90 days)
    const leadsBySourceMap = new Map<string, number>()
    for (const lead of leads) {
      if (now - new Date(lead.createdAt).getTime() > 90 * 86400000) continue
      leadsBySourceMap.set(lead.source, (leadsBySourceMap.get(lead.source) ?? 0) + 1)
    }
    const leadsBySource = [...leadsBySourceMap.entries()].map(([source, count]) => ({ source, count }))

    const thirtyDaysAgo = now - 30 * 86400000
    const newLeads30 = leads.filter((l) => new Date(l.createdAt).getTime() > thirtyDaysAgo).length
    const dueSoonTasks = tasks.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < now + 7 * 86400000).length

    return json({
      kpis: {
        pipelineValue: openDeals.reduce((s, d) => s + d.amount, 0),
        openDeals: openDeals.length,
        wonRevenue: wonDeals.reduce((s, d) => s + d.amount, 0),
        winRate: wonDeals.length + lostDeals.length > 0 ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100) : 0,
        newLeads30,
        totalLeads: leads.length,
        contacts,
        accounts,
        openTasks: tasks.filter((t) => t.status !== 'completed').length,
        dueSoonTasks,
      },
      revenueByMonth,
      pipelineByStage,
      leadsBySource,
      recentActivities: activities,
      upcomingTasks: tasks,
      topDeals: [...openDeals].sort((a, b) => b.amount - a.amount).slice(0, 5),
    })
  } catch (e) {
    return errorResponse(e)
  }
}
