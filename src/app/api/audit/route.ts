import { db } from '@/lib/db'
import { errorResponse, json, requireAuth } from '@/lib/auth'

// Org audit trail (admin+ only)
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req, 'admin')
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
    const pageSize = 30
    const action = url.searchParams.get('action')
    const entity = url.searchParams.get('entity')

    const where = {
      orgId: auth.org.id,
      ...(action ? { action } : {}),
      ...(entity ? { entity } : {}),
    }

    const [rows, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, avatarColor: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.auditLog.count({ where }),
    ])

    return json({ rows, total, page, pageSize })
  } catch (e) {
    return errorResponse(e)
  }
}
