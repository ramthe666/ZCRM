import { db } from '@/lib/db'
import { errorResponse, getAuth, json, requireAuth, ApiError } from '@/lib/auth'
import { z } from 'zod'

export async function GET(req: Request) {
  try {
    const auth = await getAuth(req)
    if (!auth) return json({ user: null })

    const memberships = await db.membership.findMany({
      where: { userId: auth.user.id, status: 'active' },
      include: {
        org: {
          select: { id: true, name: true, slug: true, plan: true, planStatus: true, billingCycle: true, currency: true, trialEndsAt: true, billingEmail: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Pending invitations addressed to this user's email for orgs they have
    // NOT joined yet (drives the "You've been invited" banner after sign-in).
    const pendingRows = await db.invitation.findMany({
      where: {
        email: auth.user.email.toLowerCase(),
        status: 'pending',
        expiresAt: { gt: new Date() },
        org: { memberships: { none: { userId: auth.user.id, status: 'active' } } },
      },
      include: { org: { select: { name: true } }, invitedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    const pendingInvitations = pendingRows.map((i) => ({
      token: i.token,
      orgName: i.org.name,
      role: i.role,
      inviterName: i.invitedBy?.name ?? null,
      expiresAt: i.expiresAt,
    }))

    return json({ user: auth.user, memberships, activeOrgId: auth.org.id, pendingInvitations })
  } catch (e) {
    return errorResponse(e)
  }
}

const profileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  title: z.string().max(80).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth(req)
    const parsed = profileSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid input')

    const user = await db.user.update({ where: { id: auth.user.id }, data: parsed.data })
    return json({
      user: { id: user.id, email: user.email, name: user.name, title: user.title, avatarColor: user.avatarColor },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
