import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, errorResponse, json, requireAuth } from '@/lib/auth'
import { audit } from '@/lib/events'

// GET → current org details · PATCH → update org settings (admin)
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    const org = await db.organization.findUnique({ where: { id: auth.org.id } })
    if (!org) throw new ApiError(404, 'Workspace not found')
    return json({ org })
  } catch (e) {
    return errorResponse(e)
  }
}

const schema = z.object({
  name: z.string().min(2).max(80).optional(),
  currency: z.string().min(3).max(3).optional(),
  billingEmail: z.string().email().optional().nullable(),
})

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth(req, 'admin')
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid input')

    const org = await db.organization.update({ where: { id: auth.org.id }, data: parsed.data })
    await audit(auth.org.id, auth.user.id, 'update', 'organization', org.id, `Updated workspace settings`)
    return json({ org })
  } catch (e) {
    return errorResponse(e)
  }
}
