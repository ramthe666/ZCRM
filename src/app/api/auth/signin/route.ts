import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, createSession, errorResponse, json, rateLimit, verifyPassword } from '@/lib/auth'
import { audit } from '@/lib/events'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'local'
    rateLimit(`signin:${ip}`, 12, 300000)

    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid input')

    const email = parsed.data.email.toLowerCase().trim()
    const user = await db.user.findUnique({ where: { email } })
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      throw new ApiError(401, 'Incorrect email or password')
    }

    const memberships = await db.membership.findMany({
      where: { userId: user.id, status: 'active' },
      include: { org: true },
      orderBy: { createdAt: 'asc' },
    })
    if (memberships.length === 0) throw new ApiError(403, 'No active workspace found for this account')

    await createSession(user.id, req.headers.get('user-agent'))
    await audit(memberships[0].orgId, user.id, 'signin', null, null, `${user.name} signed in`)

    return json({
      user: { id: user.id, email: user.email, name: user.name, title: user.title, avatarColor: user.avatarColor },
      memberships: memberships.map((m) => ({ role: m.role, status: m.status, org: m.org })),
      activeOrgId: memberships[0].orgId,
    })
  } catch (e) {
    return errorResponse(e)
  }
}
