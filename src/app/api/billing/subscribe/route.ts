import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, errorResponse, json, requireAuth } from '@/lib/auth'
import { audit, notify } from '@/lib/events'
import { PLANS } from '@/lib/limits'

// POST /api/billing/subscribe { plan, cycle } — mock checkout that updates the
// workspace plan and issues an invoice. In production this is where a Stripe
// Checkout session would be created and the webhook would confirm.
const schema = z.object({
  plan: z.enum(['starter', 'standard', 'professional', 'enterprise']),
  cycle: z.enum(['monthly', 'yearly']).default('monthly'),
})

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, 'owner')
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) throw new ApiError(400, 'Invalid plan selection')
    const { plan, cycle } = parsed.data

    const spec = PLANS[plan]
    if (!spec) throw new ApiError(400, 'Unknown plan')

    const seats = await db.membership.count({ where: { orgId: auth.org.id } })
    const unit = cycle === 'yearly' ? spec.yearly : spec.price
    const amount = Math.round(unit * seats * 100) / 100

    const org = await db.organization.update({
      where: { id: auth.org.id },
      data: { plan, billingCycle: cycle, planStatus: 'active' },
    })

    const count = await db.invoice.count({ where: { orgId: auth.org.id } })
    const invoice = await db.invoice.create({
      data: {
        orgId: auth.org.id,
        number: `NOVA-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        plan,
        cycle,
        seats,
        amount,
        currency: org.currency,
        status: 'paid',
        dueAt: new Date(Date.now() + 30 * 86400000),
      },
    })

    await audit(auth.org.id, auth.user.id, 'subscribe', 'billing', invoice.id, `Subscribed to ${spec.name} (${cycle}) — $${amount}/mo for ${seats} seats`)
    await notify(auth.user.id, auth.org.id, `Plan updated to ${spec.name}`, `${seats} seats × $${unit}/${cycle === 'yearly' ? 'mo billed yearly' : 'mo'} — invoice ${invoice.number}`, 'billing')

    return json({ org, invoice }, 201)
  } catch (e) {
    return errorResponse(e)
  }
}
