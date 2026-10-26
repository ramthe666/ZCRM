import { db } from '@/lib/db'
import { ApiError, errorResponse, json, rateLimit, requireAuth } from '@/lib/auth'
import { audit } from '@/lib/events'
import { seedOrgData } from '@/lib/seed'

// POST /api/demo/reset — admin-only, demo workspace only (slug 'nimbus-works').
// Wipes the demo org's CRM data and re-seeds the rich sample dataset so anyone
// can restore a pristine shared demo at any time. Memberships, users,
// integrations and the audit trail are preserved.
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, 'admin')
    rateLimit(`demo-reset:${auth.user.id}`, 3, 10 * 60_000)

    // Only the shared demo workspace may be reset. The seeded demo org's slug
    // is "nimbusworks" (prisma/seed.ts); "nimbus-works" is accepted too so the
    // guard matches either spelling of the demo slug.
    if (auth.org.slug !== 'nimbusworks' && auth.org.slug !== 'nimbus-works') {
      throw new ApiError(403, 'Demo reset is only available in the shared demo workspace')
    }

    const org = await db.organization.findUnique({ where: { id: auth.org.id } })
    if (!org) throw new ApiError(404, 'Workspace not found')

    // The demo dataset is attributed to the workspace owner.
    const ownerMembership = await db.membership.findFirst({
      where: { orgId: org.id, role: 'owner', status: 'active' },
      orderBy: { createdAt: 'asc' },
    })
    if (!ownerMembership) throw new ApiError(409, 'Demo workspace has no owner membership to re-seed for')

    // Wipe tenant data (keep memberships, users, integrations, auditLogs).
    await db.$transaction([
      db.deal.deleteMany({ where: { orgId: org.id } }),
      db.task.deleteMany({ where: { orgId: org.id } }),
      db.activity.deleteMany({ where: { orgId: org.id } }),
      db.lead.deleteMany({ where: { orgId: org.id } }),
      db.campaign.deleteMany({ where: { orgId: org.id } }),
      db.emailTemplate.deleteMany({ where: { orgId: org.id } }),
      db.contact.deleteMany({ where: { orgId: org.id } }),
      db.account.deleteMany({ where: { orgId: org.id } }),
      db.product.deleteMany({ where: { orgId: org.id } }),
      db.workflow.deleteMany({ where: { orgId: org.id } }),
      db.invoice.deleteMany({ where: { orgId: org.id } }),
      db.notification.deleteMany({ where: { orgId: org.id } }),
    ])

    // Restore the rich demo dataset.
    await seedOrgData(org.id, ownerMembership.userId, true)

    await audit(org.id, auth.user.id, 'update', 'organization', org.id, 'Demo workspace data was reset')

    return json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
