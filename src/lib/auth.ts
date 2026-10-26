import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

export const SESSION_COOKIE = 'nova_session'
const SESSION_DAYS = 30

// ── Password hashing (scrypt — zero external deps) ──────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const original = Buffer.from(hash, 'hex')
  return candidate.length === original.length && timingSafeEqual(candidate, original)
}

// ── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(userId: string, req?: Request) {
  const token = randomUUID().replace(/-/g, '') + randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000)
  await db.session.create({ data: { token, userId, expiresAt, userAgent: req?.headers.get('user-agent') ?? null } })
  const jar = await cookies()

  // Adaptive cookie policy:
  // - Over HTTPS (Vercel, Supabase, or an HTTPS preview proxy) we use SameSite=None; Secure
  //   so the session also works when the app is embedded in a cross-site iframe
  //   (e.g. sandbox preview panels). SameSite=None requires Secure.
  // - Over plain HTTP (local dev) we use SameSite=Lax, which browsers accept without Secure.
  const forwardedProto = req?.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const isHttps = forwardedProto === 'https' || req?.url.startsWith('https://') === true

  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    path: '/',
    expires: expiresAt,
    secure: isHttps,
  })
  return token
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {})
  }
  jar.delete(SESSION_COOKIE)
}

// ── Auth context ────────────────────────────────────────────────────────────

export interface AuthContext {
  user: { id: string; email: string; name: string; title: string | null; avatarColor: string }
  membership: { id: string; role: string; status: string }
  org: { id: string; name: string; slug: string; plan: string; planStatus: string; billingCycle: string; currency: string; trialEndsAt: Date | null; billingEmail: string | null }
}

export async function getAuth(req?: Request): Promise<AuthContext | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, name: true, title: true, avatarColor: true } } },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }

  const headerOrg = req?.headers.get('x-org-id') || undefined
  // Fetch all active memberships, then prefer the requested org. If the client
  // sent a stale/foreign X-Org-Id (e.g. leftover localStorage from a previous
  // account), we fall back to the user's first membership instead of treating
  // them as signed out — org switching races and stale browsers self-heal.
  const memberships = await db.membership.findMany({
    where: { userId: session.userId, status: 'active' },
    include: {
      org: {
        select: { id: true, name: true, slug: true, plan: true, planStatus: true, billingCycle: true, currency: true, trialEndsAt: true, billingEmail: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  if (memberships.length === 0) return null
  const membership =
    (headerOrg ? memberships.find((m) => m.orgId === headerOrg) : undefined) ?? memberships[0]

  return {
    user: session.user,
    membership: { id: membership.id, role: membership.role, status: membership.status },
    org: membership.org,
  }
}

// ── Role enforcement ────────────────────────────────────────────────────────

export const ROLE_LEVEL: Record<string, number> = { member: 1, manager: 2, admin: 3, owner: 4 }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function requireAuth(req?: Request, minRole: keyof typeof ROLE_LEVEL = 'member'): Promise<AuthContext> {
  const auth = await getAuth(req)
  if (!auth) throw new ApiError(401, 'Not signed in')
  const level = ROLE_LEVEL[auth.membership.role] ?? 0
  if (level < ROLE_LEVEL[minRole]) {
    throw new ApiError(403, `This action requires the ${minRole} role or higher`)
  }
  return auth
}

// ── Response helpers ────────────────────────────────────────────────────────

export function json(data: unknown, status = 200) {
  return Response.json(data as Record<string, unknown>, { status })
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return json({ error: e.message }, e.status)
  console.error('[api]', e)
  return json({ error: 'Something went wrong. Please try again.' }, 500)
}

// ── Tiny in-memory rate limiter (per key) ───────────────────────────────────

const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  b.count += 1
  if (b.count > max) throw new ApiError(429, 'Too many attempts. Please wait a moment and try again.')
}
