import { db } from '@/lib/db'
import { errorResponse, json, rateLimit } from '@/lib/auth'

// GET /api/invitations?token=<token> — PUBLIC (no auth).
// Lets a recipient preview who invited them before signing in / signing up.
// Only ever exposes display fields — never org ids, inviter ids or the tokens
// of other invitations. Rate-limited per IP. Expired-but-pending invitations
// are reported with status 'expired' (still 200) so the UI can explain.
export async function GET(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'local'
    rateLimit(`invite-peek:${ip}`, 30, 60_000)

    const token = new URL(req.url).searchParams.get('token') ?? ''
    if (!token) return json({ error: 'Invitation not found or expired' }, 404)

    const invitation = await db.invitation.findUnique({
      where: { token },
      include: { org: { select: { name: true } }, invitedBy: { select: { name: true } } },
    })
    if (!invitation) return json({ error: 'Invitation not found or expired' }, 404)

    const status = invitation.status === 'pending' && invitation.expiresAt < new Date() ? 'expired' : invitation.status

    return json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        orgName: invitation.org.name,
        inviterName: invitation.invitedBy?.name ?? null,
        expiresAt: invitation.expiresAt,
        status,
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
