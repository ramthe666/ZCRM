import { db } from '@/lib/db'
import { ApiError, errorResponse, json, requireAuth } from '@/lib/auth'
import { buildData, getEntity, modelDelegate } from '@/lib/entities'
import { audit } from '@/lib/events'
import { PLANS } from '@/lib/limits'

// POST /api/import { entity: 'contacts'|'leads', rows: [...] }
// Rows are plain objects from client-side CSV parsing. Per-row validation,
// returns a per-row error report. Max 500 rows per call.
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req)
    const body = (await req.json().catch(() => ({}))) as { entity?: string; rows?: Record<string, unknown>[] }
    const entity = body.entity ?? ''
    if (entity !== 'contacts' && entity !== 'leads') throw new ApiError(400, 'Import supports contacts and leads')
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : []
    if (rows.length === 0) throw new ApiError(400, 'No rows to import')

    // Plan limit
    const existingCount = entity === 'contacts'
      ? await db.contact.count({ where: { orgId: auth.org.id } })
      : await db.lead.count({ where: { orgId: auth.org.id } })
    const limits = PLANS[auth.org.plan] ?? PLANS.starter
    if (entity === 'contacts' && limits.contacts < 1000000 && existingCount + rows.length > limits.contacts) {
      throw new ApiError(402, `This import would exceed your ${limits.name} contact limit (${limits.contacts}).`)
    }

    const spec = getEntity(entity)
    const delegate = modelDelegate(spec)

    const errors: { row: number; error: string }[] = []
    let inserted = 0

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i]
      // Accept "name" as a full name fallback
      const row = { ...raw }
      if (row.name && !row.firstName && !row.lastName) {
        const parts = String(row.name).trim().split(/\s+/)
        row.firstName = parts[0] ?? ''
        row.lastName = parts.slice(1).join(' ') || '—'
      }
      try {
        const data = buildData(spec, row, true)
        data.orgId = auth.org.id
        if (spec.ownerField && !data[spec.ownerField]) data[spec.ownerField] = auth.user.id
        await delegate.create({ data })
        inserted += 1
      } catch (err) {
        errors.push({ row: i + 1, error: err instanceof ApiError ? err.message : 'Invalid row' })
      }
    }

    await audit(auth.org.id, auth.user.id, 'import', entity, null, `Imported ${inserted} ${entity} from CSV (${errors.length} failed)`)

    return json({ inserted, failed: errors.length, errors }, 201)
  } catch (e) {
    return errorResponse(e)
  }
}
