import { db } from '@/lib/db'

// Cross-cutting side effects: notifications + audit trail.
// Always fire-and-forget safe: never break the main request.

export async function notify(
  userId: string,
  orgId: string,
  title: string,
  body?: string | null,
  type: string = 'info',
  link?: string | null
) {
  try {
    await db.notification.create({
      data: { userId, orgId, title, body: body ?? null, type, link: link ?? null },
    })
  } catch (e) {
    console.error('[notify]', e)
  }
}

export async function audit(
  orgId: string,
  userId: string | null,
  action: string,
  entity: string | null,
  entityId: string | null,
  summary: string
) {
  try {
    await db.auditLog.create({
      data: { orgId, userId, action, entity, entityId, summary: summary.slice(0, 300) },
    })
  } catch (e) {
    console.error('[audit]', e)
  }
}
