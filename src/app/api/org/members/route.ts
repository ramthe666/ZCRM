import { z } from 'zod'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { ApiError, errorResponse, json, rateLimit, requireAuth } from '@/lib/auth'
import { audit } from '@/lib/events'
import { checkLimit } from '@/lib/limits'
import { inviteUrl, sendMail, teamInviteEmail } from '@/lib/mailer'

// GET  → team members (any member can view)
// POST → invite a teammate by email (admin+). Creates a pending Invitation with
//        a unique 64-hex token (valid 7 days) and emails it via Resend. When
//        no RESEND_API_KEY is configured the response reports emailSent:false
//        and the UI offers a copy-link fallback. Re-inviting an email that
//        already has a pending invitation regenerates the token + extends the
//        expiry and re-sends (idempotent-friendly). No user accounts are
//        created here — the invitee signs up / signs in with that exact email
//        to accept.
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    const rows = await db.membership.findMany({
      where: { orgId: auth.org.id },
      include: { user: { select: { id: true, name: true, email: true, title: true, avatarColor: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return json({ rows })
  } catch (e) {
    return errorResponse(e)
  }
}

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  role: z.enum(['admin', 'manager', 'member']).default('member'),
})

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, 'admin')
    rateLimit(`invite:${auth.user.id}`, 12, 5 * 60_000)

    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid input')
    const { role } = parsed.data
    const email = parsed.data.email.toLowerCase().trim()

    // Plan seat limit (memberships + this invite would become a seat on accept)
    await checkLimit(auth.org.id, auth.org.plan, 'seats')

    // Already an ACTIVE member? Block the duplicate invite.
    const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (existingUser) {
      const membership = await db.membership.findUnique({
        where: { userId_orgId: { userId: existingUser.id, orgId: auth.org.id } },
      })
      if (membership?.status === 'active') {
        throw new ApiError(409, `${email} is already a member of this workspace`)
      }
    }

    // Re-invite: refresh the token + expiry of an existing pending invitation.
    const pending = await db.invitation.findFirst({
      where: { orgId: auth.org.id, email, status: 'pending' },
    })
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 86400000)

    const invitation = pending
      ? await db.invitation.update({
          where: { id: pending.id },
          data: { token, expiresAt, role, status: 'pending', invitedById: auth.user.id },
        })
      : await db.invitation.create({
          data: { orgId: auth.org.id, email, role, token, status: 'pending', invitedById: auth.user.id, expiresAt },
        })

    // Deliver the email (demo mode → caller shows the copy-link fallback)
    const mail = teamInviteEmail({
      orgName: auth.org.name,
      inviterName: auth.user.name,
      role,
      inviteUrl: inviteUrl(token, req),
      expiresAt: invitation.expiresAt,
    })
    const result = await sendMail({ to: email, subject: mail.subject, html: mail.html, text: mail.text })
    const emailSent = result.delivered

    await db.activity.create({
      data: {
        orgId: auth.org.id,
        userId: auth.user.id,
        type: 'email',
        subject: `Team invitation sent to ${email}`,
        body: emailSent
          ? `Invitation email for the ${role} role delivered via Resend. Expires ${expiresAt.toISOString().slice(0, 10)}.`
          : `Invitation for the ${role} role generated in demo mode (no RESEND_API_KEY configured) — share the invite link manually. Expires ${expiresAt.toISOString().slice(0, 10)}.`,
      },
    })
    await audit(
      auth.org.id,
      auth.user.id,
      'invite',
      'invitation',
      invitation.id,
      `${auth.user.name} invited ${email} as ${role}${pending ? ' (invitation re-sent)' : ''}`
    )

    return json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
        emailSent,
        inviteToken: token,
      },
      201
    )
  } catch (e) {
    return errorResponse(e)
  }
}
