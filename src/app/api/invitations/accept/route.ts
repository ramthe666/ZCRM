import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, errorResponse, json, rateLimit, requireAuth } from '@/lib/auth'
import { audit, notify } from '@/lib/events'

// POST /api/invitations/accept { token } — signed-in users only (any role).
// The session user's email MUST match the invitation email (case-insensitive).
// Creates the active membership and marks the invitation accepted. A 409 with
// a membership payload means "already a member" — the frontend treats that as
// success.
const schema = z.object({ token: z.string().min(1, 'Invitation token is required') })

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'local'
    rateLimit(`invite-accept:${ip}`, 20, 5 * 60_000)

    const auth = await requireAuth(req)
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid input')

    const invitation = await db.invitation.findUnique({
      where: { token: parsed.data.token },
      include: {
        org: true,
        invitedBy: { select: { id: true, name: true } },
      },
    })
    if (!invitation) throw new ApiError(404, 'Invitation not found')
    if (invitation.status !== 'pending') throw new ApiError(409, 'This invitation is no longer pending')
    if (invitation.expiresAt < new Date()) {
      await db.invitation.update({ where: { id: invitation.id }, data: { status: 'revoked' } }).catch(() => {})
      throw new ApiError(410, 'This invitation has expired')
    }

    // Strict: the invite link belongs to one specific email address.
    if (invitation.email.toLowerCase() !== auth.user.email.toLowerCase()) {
      throw new ApiError(
        403,
        `This invitation was sent to ${invitation.email}. Sign in with that email address to accept it.`
      )
    }

    const existing = await db.membership.findUnique({
      where: { userId_orgId: { userId: auth.user.id, orgId: invitation.orgId } },
    })
    if (existing) {
      if (existing.status === 'active') {
        // Idempotent success: they're already in — close the invitation and
        // report it as the documented 409 the frontend treats as success.
        await db.invitation.update({ where: { id: invitation.id }, data: { status: 'accepted' } })
        return json(
          {
            error: 'You are already a member of this workspace',
            membership: { id: existing.id, role: existing.role, status: existing.status },
          },
          409
        )
      }
      // Legacy 'invited' membership row (pre-invitation-flow data): activate it
      // with the invitation's role instead of failing on the unique constraint.
      const membership = await db.membership.update({
        where: { id: existing.id },
        data: { role: invitation.role, status: 'active' },
      })
      await db.invitation.update({ where: { id: invitation.id }, data: { status: 'accepted' } })
      if (invitation.invitedBy) {
        await notify(
          invitation.invitedBy.id,
          invitation.orgId,
          `${auth.user.name} accepted your invitation`,
          `They joined ${invitation.org.name} as ${invitation.role}.`,
          'team'
        )
      }
      await audit(invitation.orgId, auth.user.id, 'invite', 'membership', membership.id, `${auth.user.name} accepted an invitation and joined ${invitation.org.name} as ${invitation.role}`)
      return json({
        membership: { id: membership.id, role: membership.role, status: membership.status },
        org: {
          id: invitation.org.id,
          name: invitation.org.name,
          slug: invitation.org.slug,
          plan: invitation.org.plan,
          planStatus: invitation.org.planStatus,
          billingCycle: invitation.org.billingCycle,
          currency: invitation.org.currency,
          trialEndsAt: invitation.org.trialEndsAt,
          billingEmail: invitation.org.billingEmail,
        },
      })
    }

    const membership = await db.membership.create({
      data: { userId: auth.user.id, orgId: invitation.orgId, role: invitation.role, status: 'active' },
    })
    await db.invitation.update({ where: { id: invitation.id }, data: { status: 'accepted' } })

    if (invitation.invitedBy) {
      await notify(
        invitation.invitedBy.id,
        invitation.orgId,
        `${auth.user.name} accepted your invitation`,
        `They joined ${invitation.org.name} as ${invitation.role}.`,
        'team'
      )
    }
    await audit(
      invitation.orgId,
      auth.user.id,
      'invite',
      'membership',
      membership.id,
      `${auth.user.name} accepted an invitation and joined ${invitation.org.name} as ${invitation.role}`
    )

    return json({
      membership: { id: membership.id, role: membership.role, status: membership.status },
      org: {
        id: invitation.org.id,
        name: invitation.org.name,
        slug: invitation.org.slug,
        plan: invitation.org.plan,
        planStatus: invitation.org.planStatus,
        billingCycle: invitation.org.billingCycle,
        currency: invitation.org.currency,
        trialEndsAt: invitation.org.trialEndsAt,
        billingEmail: invitation.org.billingEmail,
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
