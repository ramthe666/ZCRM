import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, createSession, errorResponse, hashPassword, json, rateLimit } from '@/lib/auth'
import { seedOrgData } from '@/lib/seed'
import { audit, notify } from '@/lib/events'
import { appBaseUrl, sendMail, welcomeEmail } from '@/lib/mailer'

// Signup provisions a whole workspace (user + org + membership + sample data +
// session) — on a cold Supabase pooler connection this can take longer than
// the 10s serverless default, so allow extra headroom.
export const maxDuration = 30

const schema = z.object({
  name: z.string().min(2, 'Name is too short').max(80),
  email: z.string().email('Enter a valid email').max(160),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  companyName: z.string().min(2, 'Company name is too short').max(80),
})

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 32) || 'org'
  )
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'local'
    rateLimit(`signup:${ip}`, 8, 3600000)

    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid input')
    }
    const { name, email, password, companyName } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    const existing = await db.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) throw new ApiError(409, 'An account with this email already exists. Try signing in.')

    const baseSlug = slugify(companyName)
    let slug = baseSlug
    let attempt = 0
    while (await db.organization.findUnique({ where: { slug } })) {
      attempt += 1
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
      if (attempt > 5) break
    }

    const user = await db.user.create({
      data: { name: name.trim(), email: normalizedEmail, passwordHash: hashPassword(password) },
    })

    const org = await db.organization.create({
      data: {
        name: companyName.trim(),
        slug,
        plan: 'starter',
        planStatus: 'trialing',
        trialEndsAt: new Date(Date.now() + 14 * 86400000),
      },
    })

    await db.membership.create({ data: { userId: user.id, orgId: org.id, role: 'owner', status: 'active' } })

    // Starter sample data so the workspace feels alive immediately
    await seedOrgData(org.id, user.id, false).catch((e) => console.error('[seed]', e))

    // Auto-accept any pending, non-expired invitations addressed to this email:
    // create the memberships, close the invitations and notify each inviter.
    const acceptedInvites = await db.invitation.findMany({
      where: { email: normalizedEmail, status: 'pending', expiresAt: { gt: new Date() } },
      include: { org: true, invitedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const inviteMemberships: { role: string; status: string; org: typeof org }[] = []
    for (const invite of acceptedInvites) {
      if (invite.orgId === org.id) continue // paranoia: never self-invite into the fresh org
      const membership = await db.membership.create({
        data: { userId: user.id, orgId: invite.orgId, role: invite.role, status: 'active' },
      })
      await db.invitation.update({ where: { id: invite.id }, data: { status: 'accepted' } })
      if (invite.invitedBy) {
        await notify(
          invite.invitedBy.id,
          invite.orgId,
          `${user.name} accepted your invitation`,
          `They joined ${invite.org.name} as ${invite.role}.`,
          'team'
        )
      }
      await audit(invite.orgId, user.id, 'invite', 'membership', membership.id, `${user.name} accepted an invitation and joined ${invite.org.name} as ${invite.role}`)
      inviteMemberships.push({ role: invite.role, status: 'active', org: invite.org })
    }

    await audit(org.id, user.id, 'signup', 'organization', org.id, `${user.name} created workspace "${org.name}"`)
    await createSession(user.id, req)

    // Welcome email — async best-effort, must never fail signup.
    const welcome = welcomeEmail({ name: user.name, orgName: org.name, appUrl: appBaseUrl(req) })
    sendMail({ to: normalizedEmail, subject: welcome.subject, html: welcome.html, text: welcome.text }).catch((e) =>
      console.error('[mailer] welcome email failed:', e instanceof Error ? e.message : e)
    )

    return json(
      {
        user: { id: user.id, email: user.email, name: user.name, title: user.title, avatarColor: user.avatarColor },
        memberships: [{ role: 'owner', status: 'active', org }, ...inviteMemberships],
        activeOrgId: org.id,
      },
      201
    )
  } catch (e) {
    return errorResponse(e)
  }
}
