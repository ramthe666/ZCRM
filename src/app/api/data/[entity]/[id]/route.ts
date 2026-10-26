import { ApiError, errorResponse, json, requireAuth, ROLE_LEVEL } from '@/lib/auth'
import { applyDealRules, buildData, getEntity, modelDelegate } from '@/lib/entities'
import { audit } from '@/lib/events'
import { runWorkflows } from '@/lib/workflow'

type Ctx = { params: Promise<{ entity: string; id: string }> }

function title(entity: string, record: Record<string, unknown>): string {
  if (entity === 'leads' || entity === 'contacts') {
    return [record.firstName, record.lastName].filter(Boolean).join(' ') || 'Untitled'
  }
  return String(record.name ?? record.title ?? record.subject ?? 'Untitled')
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { entity, id } = await ctx.params
    const spec = getEntity(entity)
    const auth = await requireAuth(req)
    const delegate = modelDelegate(spec)
    const record = (await delegate.findUnique({ where: { id }, include: spec.include })) as Record<string, unknown> | null
    if (!record || record.orgId !== auth.org.id) throw new ApiError(404, `${spec.label} not found`)
    return json(record)
  } catch (e) {
    return errorResponse(e)
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { entity, id } = await ctx.params
    const spec = getEntity(entity)
    const auth = await requireAuth(req, spec.minRoleWrite)
    const delegate = modelDelegate(spec)

    const before = (await delegate.findUnique({ where: { id } })) as Record<string, unknown> | null
    if (!before || before.orgId !== auth.org.id) throw new ApiError(404, `${spec.label} not found`)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const data = buildData(spec, body, false)
    if (Object.keys(data).length === 0) throw new ApiError(400, 'Nothing to update')
    if (entity === 'deals') applyDealRules(data, before)

    const record = (await delegate.update({ where: { id }, data, include: spec.include })) as Record<string, unknown>

    await audit(auth.org.id, auth.user.id, 'update', entity, id, `Updated ${spec.label} "${title(entity, record)}"`)

    // Workflow stage/status change events
    if (spec.event) {
      if (entity === 'deals' && data.stage && before.stage !== data.stage) {
        await runWorkflows(auth.org.id, { type: 'deal.stage_changed', entity: 'deal', record, before })
      } else if (entity === 'leads' && data.status && before.status !== data.status) {
        await runWorkflows(auth.org.id, { type: 'lead.status_changed', entity: 'lead', record, before })
      }
    }

    return json(record)
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { entity, id } = await ctx.params
    const spec = getEntity(entity)
    // Any signed-in role may attempt a delete; the ownership rules below decide.
    const auth = await requireAuth(req)
    const delegate = modelDelegate(spec)

    const existing = (await delegate.findUnique({ where: { id } })) as Record<string, unknown> | null
    if (!existing || existing.orgId !== auth.org.id) throw new ApiError(404, `${spec.label} not found`)

    // Role matrix: manager+ may delete any record. A member may delete ONLY
    // records assigned to them (ownerId for leads/contacts/accounts/deals,
    // assigneeId for tasks, userId for activities). Products, templates,
    // workflows and campaigns have no owner — members can never delete those.
    const level = ROLE_LEVEL[auth.membership.role] ?? 0
    if (level < ROLE_LEVEL.manager) {
      const ownerId = spec.ownerField ? existing[spec.ownerField] : null
      if (ownerId !== auth.user.id) {
        throw new ApiError(403, 'Members can only delete records assigned to them')
      }
    } else if (level < (ROLE_LEVEL[spec.minRoleDelete] ?? 1)) {
      throw new ApiError(403, `This action requires the ${spec.minRoleDelete} role or higher`)
    }

    await delegate.delete({ where: { id } })
    await audit(auth.org.id, auth.user.id, 'delete', entity, id, `Deleted ${spec.label} "${title(entity, existing)}"`)

    return json({ ok: true })
  } catch (e) {
    const message =
      e instanceof Error && e.message.includes('FOREIGN KEY')
        ? 'Cannot delete — this record is referenced by other records.'
        : undefined
    return errorResponse(message ? new ApiError(409, message) : e)
  }
}
