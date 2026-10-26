import { db } from '@/lib/db'
import { errorResponse, json, requireAuth } from '@/lib/auth'

// GET  → latest notifications for the current user + unread count
// PATCH → { id } mark one as read | { all: true } mark all as read
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    const [rows, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { orgId: auth.org.id, userId: auth.user.id },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      db.notification.count({ where: { orgId: auth.org.id, userId: auth.user.id, read: false } }),
    ])
    return json({ rows, unreadCount })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth(req)
    const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean }

    if (body.all) {
      await db.notification.updateMany({ where: { orgId: auth.org.id, userId: auth.user.id, read: false }, data: { read: true } })
      return json({ ok: true })
    }
    if (body.id) {
      await db.notification.updateMany({ where: { id: body.id, userId: auth.user.id }, data: { read: true } })
      return json({ ok: true })
    }
    return json({ ok: false }, 400)
  } catch (e) {
    return errorResponse(e)
  }
}
