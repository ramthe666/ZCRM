import { z } from 'zod'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { ApiError, errorResponse, json, rateLimit, requireAuth } from '@/lib/auth'
import { audit } from '@/lib/events'
import { inviteUrl, sendMail, teamInviteEmail } from '@/lib/mailer'

// ── Invitation management (admin+) ──────────────────────────────────────────
// GET    → invitation history for the active org (pending + accepted/revoked)
// POST   → { id } re-send a PENDING invitation (new token + 7-day expiry)
// DELETE → ?id= revoke a PENDING invitation

const resendSchema = z.object({ id: z.string().min(1, 'Invitation id is required') })

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req, 'admin')
    const rows = await db.invitation.findMany({
      where: { orgId: auth.org.id },
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return json({
      rows: rows.map((r) => ({
        id: r.id,
        email: r.email,
        role: r.role,
        status: r.status,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        invitedByName: r.invitedBy?.name ?? null,
      })),
    })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, 'admin')
    rateLimit(`invite:${auth.user.id}`, 12, 5 * 60_000)

    const parsed = resendSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid input')

    const invitation = await db.invitation.findFirst({ where: { id: parsed.data.id, orgId: auth.org.id } })
    if (!invitation) throw new ApiError(404, 'Invitation not found')
    if (invitation.status !== 'pending') throw new ApiError(409, 'Only pending invitations can be re-sent')

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 86400000)
    const updated = await db.invitation.update({
      where: { id: invitation.id },
      data: { token, expiresAt, status: 'pending', invitedById: auth.user.id },
    })

    const mail = teamInviteEmail({
      orgName: auth.org.name,
      inviterName: auth.user.name,
      role: updated.role,
      inviteUrl: inviteUrl(token),
      expiresAt: updated.expiresAt,
    })
    const result = await sendMail({ to: updated.email, subject: mail.subject, html: mail.html, text: mail.text })
    const emailSent = result.delivered

    await db.activity.create({
      data: {
        orgId: auth.org.id,
        userId: auth.user.id,
        type: 'email',
        subject: `Team invitation re-sent to ${updated.email}`,
        body: emailSent
          ? `Invitation email re-delivered via Resend. New expiry ${expiresAt.toISOString().slice(0, 10)}.`
          : `Invitation re-generated in demo mode (no RESEND_API_KEY configured) — share the invite link manually. New expiry ${expiresAt.toISOString().slice(0, 10)}.`,
      },
    })
    await audit(auth.org.id, auth.user.id, 'invite', 'invitation', updated.id, `${auth.user.name} re-sent the invitation to ${updated.email}`)

    return json({
      invitation: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        status: updated.status,
        expiresAt: updated.expiresAt,
      },
      emailSent,
      inviteToken: token,
    })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth(req, 'admin')
    const id = new URL(req.url).searchParams.get('id') ?? ''
    if (!id) throw new ApiError(400, 'Invitation id is required')

    const invitation = await db.invitation.findFirst({ where: { id, orgId: auth.org.id } })
    if (!invitation) throw new ApiError(404, 'Invitation not found')
    if (invitation.status !== 'pending') throw new ApiError(409, 'Only pending invitations can be revoked')

    await db.invitation.update({ where: { id }, data: { status: 'revoked' } })
    await audit(auth.org.id, auth.user.id, 'delete', 'invitation', id, `${auth.user.name} revoked the invitation to ${invitation.email}`)

    return json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
