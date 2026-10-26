import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, errorResponse, json, rateLimit, requireAuth } from '@/lib/auth'
import { audit, notify } from '@/lib/events'

// POST /api/invitations/decline { token } — signed-in users only.
// Same strict email-match rule as accept; marks the invitation revoked and
// politely lets the inviter know.
const schema = z.object({ token: z.string().min(1, 'Invitation token is required') })

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'local'
    rateLimit(`invite-decline:${ip}`, 20, 5 * 60_000)

    const auth = await requireAuth(req)
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid input')

    const invitation = await db.invitation.findUnique({
      where: { token: parsed.data.token },
      include: { org: { select: { id: true, name: true } }, invitedBy: { select: { id: true, name: true } } },
    })
    if (!invitation) throw new ApiError(404, 'Invitation not found')
    if (invitation.status !== 'pending') throw new ApiError(409, 'This invitation is no longer pending')
    if (invitation.expiresAt < new Date()) {
      await db.invitation.update({ where: { id: invitation.id }, data: { status: 'revoked' } }).catch(() => {})
      throw new ApiError(410, 'This invitation has expired')
    }

    if (invitation.email.toLowerCase() !== auth.user.email.toLowerCase()) {
      throw new ApiError(
        403,
        `This invitation was sent to ${invitation.email}. Sign in with that email address to decline it.`
      )
    }

    await db.invitation.update({ where: { id: invitation.id }, data: { status: 'revoked' } })

    if (invitation.invitedBy) {
      await notify(
        invitation.invitedBy.id,
        invitation.org.id,
        `${auth.user.name} declined your invitation`,
        `They chose not to join ${invitation.org.name} — no action needed, the invitation is now closed.`,
        'team'
      )
    }
    await audit(invitation.org.id, auth.user.id, 'invite', 'invitation', invitation.id, `${auth.user.name} declined the invitation to join ${invitation.org.name}`)

    return json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
