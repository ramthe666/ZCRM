import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, errorResponse, json, requireAuth } from '@/lib/auth'
import { audit, notify } from '@/lib/events'

type Ctx = { params: Promise<{ id: string }> }

// PATCH → change a member's role (admin) · DELETE → remove member (admin)
const schema = z.object({ role: z.enum(['admin', 'manager', 'member']) })

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth(req, 'admin')
    const { id } = await ctx.params
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) throw new ApiError(400, 'Invalid role')

    const membership = await db.membership.findFirst({ where: { id, orgId: auth.org.id }, include: { user: true } })
    if (!membership) throw new ApiError(404, 'Member not found')
    if (membership.role === 'owner') throw new ApiError(403, "The workspace owner's role cannot be changed")

    const updated = await db.membership.update({
      where: { id },
      data: { role: parsed.data.role, status: 'active' },
      include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } },
    })

    await audit(auth.org.id, auth.user.id, 'update', 'membership', id, `${membership.user.name}'s role changed to ${parsed.data.role}`)
    await notify(membership.userId, auth.org.id, `Your role is now ${parsed.data.role}`, 'Updated by ' + auth.user.name, 'team')

    return json({ membership: updated })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth(req, 'admin')
    const { id } = await ctx.params

    const membership = await db.membership.findFirst({ where: { id, orgId: auth.org.id }, include: { user: true } })
    if (!membership) throw new ApiError(404, 'Member not found')
    if (membership.role === 'owner') throw new ApiError(403, 'The workspace owner cannot be removed')

    await db.membership.delete({ where: { id } })
    await audit(auth.org.id, auth.user.id, 'delete', 'membership', id, `${membership.user.name} was removed from the workspace`)

    return json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
