import { db } from '@/lib/db'
import { errorResponse, json, requireAuth } from '@/lib/auth'

// Extended analytics for the Reports module.
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    const orgId = auth.org.id

    const [deals, leads, activities, tasks, users] = await Promise.all([
      db.deal.findMany({
        where: { orgId },
        select: { id: true, name: true, amount: true, stage: true, createdAt: true, closedAt: true, ownerId: true, source: true },
      }),
      db.lead.findMany({ where: { orgId }, select: { id: true, source: true, status: true, value: true, createdAt: true } }),
      db.activity.findMany({ where: { orgId }, select: { id: true, type: true, occurredAt: true } }),
      db.task.findMany({ where: { orgId }, select: { id: true, status: true, priority: true } }),
      db.membership.findMany({ where: { orgId, status: 'active' }, include: { user: { select: { id: true, name: true, avatarColor: true } } } }),
    ])

    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    // 12-month created vs won
    const months: { month: string; label: string; createdValue: number; createdCount: number; wonValue: number; wonCount: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      months.push({ month: monthKey(d), label: d.toLocaleString('en-US', { month: 'short' }), createdValue: 0, createdCount: 0, wonValue: 0, wonCount: 0 })
    }
    for (const deal of deals) {
      const createdBucket = months.find((m) => m.month === monthKey(new Date(deal.createdAt)))
      if (createdBucket) {
        createdBucket.createdValue += deal.amount
        createdBucket.createdCount += 1
      }
      if (deal.stage === 'closed_won' && deal.closedAt) {
        const wonBucket = months.find((m) => m.month === monthKey(new Date(deal.closedAt as Date)))
        if (wonBucket) {
          wonBucket.wonValue += deal.amount
          wonBucket.wonCount += 1
        }
      }
    }

    // Sales performance by owner
    const userMap = new Map(users.map((m) => [m.user.id, m.user]))
    const byOwner = new Map<string, { name: string; won: number; pipeline: number; deals: number }>()
    for (const deal of deals) {
      if (!deal.ownerId) continue
      const u = userMap.get(deal.ownerId)
      const entry = byOwner.get(deal.ownerId) ?? { name: u?.name ?? 'Unassigned', won: 0, pipeline: 0, deals: 0 }
      entry.deals += 1
      if (deal.stage === 'closed_won') entry.won += deal.amount
      else if (deal.stage !== 'closed_lost') entry.pipeline += deal.amount
      byOwner.set(deal.ownerId, entry)
    }

    // Funnel: deals that ever reached a stage (approx: current stage position)
    const stageOrder = ['qualification', 'needs_analysis', 'value_prop', 'negotiation', 'closed_won']
    const funnel = stageOrder.map((stage) => {
      const reached = deals.filter((d) => stageOrder.indexOf(d.stage) >= stageOrder.indexOf(stage) && d.stage !== 'closed_lost').length
      return { stage, count: reached }
    })

    const leadsByStatus = ['new', 'contacted', 'qualified', 'unqualified', 'converted'].map((status) => ({
      status,
      count: leads.filter((l) => l.status === status).length,
    }))

    const activitiesByType = ['call', 'meeting', 'email', 'note', 'whatsapp'].map((type) => ({
      type,
      count: activities.filter((a) => a.type === type).length,
    }))

    const tasksByStatus = ['not_started', 'in_progress', 'completed', 'deferred'].map((status) => ({
      status,
      count: tasks.filter((t) => t.status === status).length,
    }))

    const wonDeals = deals.filter((d) => d.stage === 'closed_won')
    const lostDeals = deals.filter((d) => d.stage === 'closed_lost')

    return json({
      summary: {
        totalDeals: deals.length,
        totalWon: wonDeals.reduce((s, d) => s + d.amount, 0),
        totalLost: lostDeals.reduce((s, d) => s + d.amount, 0),
        winRate: wonDeals.length + lostDeals.length > 0 ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100) : 0,
        avgDealSize: deals.length ? Math.round(deals.reduce((s, d) => s + d.amount, 0) / deals.length) : 0,
        totalActivities: activities.length,
        totalLeads: leads.length,
        leadConversion: leads.length ? Math.round((leads.filter((l) => l.status === 'converted').length / leads.length) * 100) : 0,
      },
      months,
      byOwner: [...byOwner.values()].sort((a, b) => b.won - a.won),
      funnel,
      leadsByStatus,
      activitiesByType,
      tasksByStatus,
    })
  } catch (e) {
    return errorResponse(e)
  }
}
