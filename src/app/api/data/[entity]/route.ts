import { errorResponse, json, requireAuth, ApiError } from '@/lib/auth'
import { applyDealRules, buildData, buildOrderBy, buildWhere, getEntity, modelDelegate } from '@/lib/entities'
import { audit, notify } from '@/lib/events'
import { runWorkflows } from '@/lib/workflow'
import { checkLimit } from '@/lib/limits'

type Ctx = { params: Promise<{ entity: string }> }

export function entityTitle(entity: string, record: Record<string, unknown>): string {
  if (entity === 'leads' || entity === 'contacts') {
    return [record.firstName, record.lastName].filter(Boolean).join(' ') || 'Untitled'
  }
  return String(record.name ?? record.title ?? record.subject ?? 'Untitled')
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { entity } = await ctx.params
    const spec = getEntity(entity)
    const auth = await requireAuth(req)
    const url = new URL(req.url)

    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 25) || 25))
    const where = buildWhere(spec, url.searchParams, auth.org.id)
    const orderBy = buildOrderBy(spec, url.searchParams)
    const delegate = modelDelegate(spec)

    const [rows, total] = await Promise.all([
      delegate.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: spec.include }) as Promise<Record<string, unknown>[]>,
      delegate.count({ where }) as Promise<number>,
    ])

    return json({ rows, total, page, pageSize })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { entity } = await ctx.params
    const spec = getEntity(entity)
    const auth = await requireAuth(req, spec.minRoleWrite)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    // Plan limits
    if (entity === 'contacts') await checkLimit(auth.org.id, auth.org.plan, 'contacts')
    if (entity === 'workflows') await checkLimit(auth.org.id, auth.org.plan, 'workflows')
    if (entity === 'campaigns') await checkLimit(auth.org.id, auth.org.plan, 'campaigns')

    const data = buildData(spec, body, true)
    data.orgId = auth.org.id
    if (spec.ownerField && !data[spec.ownerField]) data[spec.ownerField] = auth.user.id
    if (entity === 'activities') data.userId = auth.user.id
    if (entity === 'deals') applyDealRules(data)

    const delegate = modelDelegate(spec)
    const record = (await delegate.create({ data, include: spec.include })) as Record<string, unknown>

    const title = entityTitle(entity, record)
    await audit(auth.org.id, auth.user.id, 'create', entity, String(record.id ?? ''), `Created ${spec.label} "${title}"`)

    if (spec.event) {
      await runWorkflows(auth.org.id, { type: `${spec.event}.created`, entity: spec.event, record })
    }
    if (entity === 'tasks' && record.assigneeId && record.assigneeId !== auth.user.id) {
      await notify(String(record.assigneeId), auth.org.id, `New task assigned: ${title}`, 'Assigned by ' + auth.user.name, 'task')
    }

    return json(record, 201)
  } catch (e) {
    return errorResponse(e)
  }
}
