import { db } from '@/lib/db'
import { ApiError, errorResponse, requireAuth } from '@/lib/auth'
import { ENTITIES } from '@/lib/entities'

// GET /api/export?entity=contacts → CSV download (cookie-authenticated link).
// Manager+ only (bulk data exfiltration is not for every seat).
const EXPORTABLE = ['contacts', 'leads', 'accounts', 'deals', 'tasks', 'products', 'activities']

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = value instanceof Date ? value.toISOString() : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const COLUMN_LABELS: Record<string, string> = {
  ownerId: 'owner_id',
  accountId: 'account_id',
  contactId: 'contact_id',
  assigneeId: 'assignee_id',
  relatedType: 'related_type',
  relatedId: 'related_id',
  expectedCloseAt: 'expected_close_at',
  unitPrice: 'unit_price',
  billingCycle: 'billing_cycle',
  occurredAt: 'occurred_at',
  durationMin: 'duration_min',
  templateId: 'template_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  convertedAt: 'converted_at',
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req, 'manager')
    const entity = new URL(req.url).searchParams.get('entity') ?? ''
    if (!EXPORTABLE.includes(entity)) throw new ApiError(400, 'Unsupported export entity')

    const spec = ENTITIES[entity]
    const delegate = (await import('@/lib/entities')).modelDelegate(spec)
    const rows = (await delegate.findMany({ where: { orgId: auth.org.id }, orderBy: { createdAt: 'desc' }, take: 5000 })) as Record<string, unknown>[]

    const columns = ['id', ...spec.fields.map((f) => f.name), 'createdAt', 'updatedAt']
    const header = columns.map((c) => COLUMN_LABELS[c] ?? c).join(',')

    const lines = [header, ...rows.map((row) => columns.map((c) => csvEscape(row[c])).join(','))]
    const csv = '\uFEFF' + lines.join('\r\n')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="nova-crm-${entity}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
