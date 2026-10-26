import { db } from '@/lib/db'
import { errorResponse, json, requireAuth } from '@/lib/auth'
import { PLANS } from '@/lib/limits'

// GET → invoices + current plan usage vs limits
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)

    const [invoices, seats, contacts, workflows, campaigns] = await Promise.all([
      db.invoice.findMany({ where: { orgId: auth.org.id }, orderBy: { date: 'desc' } }),
      db.membership.count({ where: { orgId: auth.org.id } }),
      db.contact.count({ where: { orgId: auth.org.id } }),
      db.workflow.count({ where: { orgId: auth.org.id } }),
      db.campaign.count({ where: { orgId: auth.org.id } }),
    ])

    const plan = PLANS[auth.org.plan] ?? PLANS.starter

    return json({
      org: auth.org,
      plan,
      plans: Object.values(PLANS),
      usage: {
        seats: { used: seats, limit: plan.seats },
        contacts: { used: contacts, limit: plan.contacts },
        workflows: { used: workflows, limit: plan.workflows },
        campaigns: { used: campaigns, limit: plan.campaigns },
      },
      invoices,
    })
  } catch (e) {
    return errorResponse(e)
  }
}
