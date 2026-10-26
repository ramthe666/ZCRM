import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, errorResponse, json, requireAuth } from '@/lib/auth'
import { audit, notify } from '@/lib/events'
import { runWorkflows } from '@/lib/workflow'
import { PLANS } from '@/lib/limits'

// Lead conversion: creates Account + Contact (+ optional Deal), marks lead converted.
const schema = z.object({
  leadId: z.string().min(1),
  createAccount: z.boolean().optional().default(true),
  createDeal: z.boolean().optional().default(true),
  dealName: z.string().max(160).optional(),
  dealAmount: z.number().nonnegative().optional(),
})

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, 'member')
    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid input')
    const { leadId, createAccount, createDeal, dealName, dealAmount } = parsed.data

    const lead = await db.lead.findFirst({ where: { id: leadId, orgId: auth.org.id } })
    if (!lead) throw new ApiError(404, 'Lead not found')
    if (lead.status === 'converted') throw new ApiError(409, 'This lead has already been converted')

    // Contact plan limit
    const contactCount = await db.contact.count({ where: { orgId: auth.org.id } })
    const limits = PLANS[auth.org.plan] ?? PLANS.starter
    if (limits.contacts < 1000000 && contactCount >= limits.contacts) {
      throw new ApiError(402, `Contact limit reached (${limits.contacts} on ${limits.name}). Upgrade in Billing.`)
    }

    // 1. Account
    let accountId: string | null = null
    if (createAccount && lead.company) {
      const account = await db.account.create({
        data: {
          orgId: auth.org.id,
          name: lead.company,
          ownerId: lead.ownerId ?? auth.user.id,
          notes: `Converted from lead ${lead.firstName} ${lead.lastName}.`,
        },
      })
      accountId = account.id
      await audit(auth.org.id, auth.user.id, 'convert', 'account', account.id, `Account "${account.name}" created from lead conversion`)
    }

    // 2. Contact
    const contact = await db.contact.create({
      data: {
        orgId: auth.org.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        title: lead.title,
        source: lead.source,
        lifecycle: 'sales_qualified',
        ownerId: lead.ownerId ?? auth.user.id,
        accountId,
        notes: lead.notes,
      },
    })
    await audit(auth.org.id, auth.user.id, 'convert', 'contact', contact.id, `Contact "${contact.firstName} ${contact.lastName}" created from lead conversion`)

    // 3. Deal
    let deal: { id: string; name: string } | null = null
    if (createDeal) {
      deal = await db.deal.create({
        data: {
          orgId: auth.org.id,
          name: dealName ?? `${lead.company ?? `${lead.firstName} ${lead.lastName}`} — New Deal`,
          amount: dealAmount ?? lead.value ?? 0,
          stage: 'qualification',
          probability: 20,
          contactId: contact.id,
          accountId,
          ownerId: lead.ownerId ?? auth.user.id,
          source: lead.source,
        },
      })
      await audit(auth.org.id, auth.user.id, 'convert', 'deal', deal.id, `Deal "${deal.name}" created from lead conversion`)
    }

    // 4. Mark lead converted
    await db.lead.update({ where: { id: lead.id }, data: { status: 'converted', convertedAt: new Date() } })
    await audit(auth.org.id, auth.user.id, 'convert', 'leads', lead.id, `Lead "${lead.firstName} ${lead.lastName}" converted`)

    // Fire workflows for the newly created records
    await runWorkflows(auth.org.id, { type: 'contact.created', entity: 'contact', record: contact as unknown as Record<string, unknown> })
    if (deal) {
      await runWorkflows(auth.org.id, {
        type: 'deal.created',
        entity: 'deal',
        record: { ...(deal as unknown as Record<string, unknown>), amount: dealAmount ?? lead.value ?? 0 },
      })
    }

    if (lead.ownerId) {
      await notify(lead.ownerId, auth.org.id, `Lead converted: ${lead.firstName} ${lead.lastName}`, 'Contact, account and deal created.', 'success')
    }

    return json({ contact, accountId, deal }, 201)
  } catch (e) {
    return errorResponse(e)
  }
}
