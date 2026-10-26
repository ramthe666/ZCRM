import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, errorResponse, hashPassword, json, requireAuth } from '@/lib/auth'
import { audit, notify } from '@/lib/events'
import { checkLimit } from '@/lib/limits'
import { randomBytes } from 'crypto'

// GET  → team members (any member can view)
// POST → invite a teammate (admin) — creates user (if needed) + invited membership.
//        If the user is new, a temporary password is returned once so the invite
//        can be shared; in production this is delivered via Resend email.
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
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid input')
    const email = parsed.data.email.toLowerCase().trim()

    await checkLimit(auth.org.id, auth.org.plan, 'seats')

    let user = await db.user.findUnique({ where: { email } })
    let tempPassword: string | null = null
    if (!user) {
      tempPassword = 'Nova-' + randomBytes(4).toString('hex')
      user = await db.user.create({
        data: {
          email,
          name: email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          passwordHash: hashPassword(tempPassword),
        },
      })
    }

    const existing = await db.membership.findUnique({ where: { userId_orgId: { userId: user.id, orgId: auth.org.id } } })
    if (existing) throw new ApiError(409, `${email} is already a member of this workspace`)

    const membership = await db.membership.create({
      data: { userId: user.id, orgId: auth.org.id, role: parsed.data.role, status: 'invited' },
      include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } },
    })

    await notify(user.id, auth.org.id, `You've been invited to ${auth.org.name}`, `Role: ${parsed.data.role}. You now have access — sign in to get started.`, 'team')
    await audit(auth.org.id, auth.user.id, 'invite', 'membership', membership.id, `${auth.user.name} invited ${email} as ${parsed.data.role}`)
    await db.activity.create({
      data: {
        orgId: auth.org.id,
        userId: auth.user.id,
        type: 'email',
        subject: `Team invitation sent to ${email}`,
        body: `Invitation email ${'queued for delivery via Resend once connected in Settings → Integrations.'}`,
      },
    })

    return json({ membership, tempPassword }, 201)
  } catch (e) {
    return errorResponse(e)
  }
}
