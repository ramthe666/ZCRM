import { db } from '@/lib/db'
import { ApiError } from '@/lib/auth'

// ── Generic entity registry ─────────────────────────────────────────────────
// Powers /api/data/[entity] for all standard CRUD modules. Whitelisted models,
// whitelisted fields, server-side coercion + validation, tenant scoped by orgId.

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'json'

export interface FieldSpec {
  name: string
  type: FieldType
  required?: boolean
  default?: unknown
}

export interface EntitySpec {
  model: string // Prisma delegate name (whitelisted via this registry)
  label: string
  fields: FieldSpec[]
  searchFields: string[]
  filterFields: string[]
  sortFields: string[]
  defaultSort: { field: string; dir: 'asc' | 'desc' }
  include?: Record<string, unknown>
  minRoleWrite: 'member' | 'manager' | 'admin'
  minRoleDelete: 'member' | 'manager' | 'admin'
  event?: string // workflow event prefix (lead/deal/contact/task)
  ownerField?: string
}

const personInclude = { select: { id: true, name: true, avatarColor: true } }

export const ENTITIES: Record<string, EntitySpec> = {
  leads: {
    model: 'lead',
    label: 'Lead',
    fields: [
      { name: 'firstName', type: 'string', required: true },
      { name: 'lastName', type: 'string', required: true },
      { name: 'email', type: 'string' },
      { name: 'phone', type: 'string' },
      { name: 'company', type: 'string' },
      { name: 'title', type: 'string' },
      { name: 'source', type: 'string', default: 'website' },
      { name: 'status', type: 'string', default: 'new' },
      { name: 'value', type: 'number', default: 0 },
      { name: 'notes', type: 'string' },
      { name: 'ownerId', type: 'string' },
    ],
    searchFields: ['firstName', 'lastName', 'email', 'company', 'phone'],
    filterFields: ['status', 'source', 'ownerId'],
    sortFields: ['createdAt', 'updatedAt', 'firstName', 'lastName', 'value', 'status'],
    defaultSort: { field: 'createdAt', dir: 'desc' },
    include: { owner: personInclude },
    minRoleWrite: 'member',
    minRoleDelete: 'manager',
    event: 'lead',
    ownerField: 'ownerId',
  },
  contacts: {
    model: 'contact',
    label: 'Contact',
    fields: [
      { name: 'firstName', type: 'string', required: true },
      { name: 'lastName', type: 'string', required: true },
      { name: 'email', type: 'string' },
      { name: 'phone', type: 'string' },
      { name: 'title', type: 'string' },
      { name: 'accountId', type: 'string' },
      { name: 'lifecycle', type: 'string', default: 'lead' },
      { name: 'source', type: 'string', default: 'website' },
      { name: 'ownerId', type: 'string' },
      { name: 'notes', type: 'string' },
    ],
    searchFields: ['firstName', 'lastName', 'email', 'phone', 'title'],
    filterFields: ['lifecycle', 'source', 'ownerId', 'accountId'],
    sortFields: ['createdAt', 'updatedAt', 'firstName', 'lastName', 'lifecycle'],
    defaultSort: { field: 'createdAt', dir: 'desc' },
    include: { owner: personInclude, account: { select: { id: true, name: true } } },
    minRoleWrite: 'member',
    minRoleDelete: 'manager',
    event: 'contact',
    ownerField: 'ownerId',
  },
  accounts: {
    model: 'account',
    label: 'Account',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'website', type: 'string' },
      { name: 'phone', type: 'string' },
      { name: 'industry', type: 'string' },
      { name: 'size', type: 'string' },
      { name: 'tier', type: 'string', default: 'standard' },
      { name: 'city', type: 'string' },
      { name: 'country', type: 'string' },
      { name: 'revenue', type: 'number' },
      { name: 'ownerId', type: 'string' },
      { name: 'notes', type: 'string' },
    ],
    searchFields: ['name', 'website', 'industry', 'city', 'country'],
    filterFields: ['tier', 'industry', 'ownerId'],
    sortFields: ['createdAt', 'updatedAt', 'name', 'revenue'],
    defaultSort: { field: 'createdAt', dir: 'desc' },
    include: { owner: personInclude },
    minRoleWrite: 'member',
    minRoleDelete: 'manager',
    event: 'account',
    ownerField: 'ownerId',
  },
  deals: {
    model: 'deal',
    label: 'Deal',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'accountId', type: 'string' },
      { name: 'contactId', type: 'string' },
      { name: 'amount', type: 'number', default: 0 },
      { name: 'stage', type: 'string', default: 'qualification' },
      { name: 'probability', type: 'number', default: 20 },
      { name: 'expectedCloseAt', type: 'date' },
      { name: 'source', type: 'string', default: 'website' },
      { name: 'ownerId', type: 'string' },
      { name: 'notes', type: 'string' },
    ],
    searchFields: ['name', 'notes'],
    filterFields: ['stage', 'ownerId', 'accountId', 'contactId', 'source'],
    sortFields: ['createdAt', 'updatedAt', 'amount', 'stage', 'expectedCloseAt'],
    defaultSort: { field: 'createdAt', dir: 'desc' },
    include: {
      owner: personInclude,
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
    minRoleWrite: 'member',
    minRoleDelete: 'manager',
    event: 'deal',
    ownerField: 'ownerId',
  },
  tasks: {
    model: 'task',
    label: 'Task',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string' },
      { name: 'status', type: 'string', default: 'not_started' },
      { name: 'priority', type: 'string', default: 'normal' },
      { name: 'dueAt', type: 'date' },
      { name: 'relatedType', type: 'string' },
      { name: 'relatedId', type: 'string' },
      { name: 'assigneeId', type: 'string' },
    ],
    searchFields: ['title', 'description'],
    filterFields: ['status', 'priority', 'assigneeId', 'relatedType', 'relatedId'],
    sortFields: ['createdAt', 'dueAt', 'priority', 'status'],
    defaultSort: { field: 'dueAt', dir: 'asc' },
    include: { assignee: personInclude },
    minRoleWrite: 'member',
    minRoleDelete: 'manager',
    event: 'task',
    ownerField: 'assigneeId',
  },
  activities: {
    model: 'activity',
    label: 'Activity',
    fields: [
      { name: 'type', type: 'string', default: 'note' },
      { name: 'subject', type: 'string', required: true },
      { name: 'body', type: 'string' },
      { name: 'outcome', type: 'string' },
      { name: 'durationMin', type: 'number' },
      { name: 'relatedType', type: 'string' },
      { name: 'relatedId', type: 'string' },
      { name: 'occurredAt', type: 'date' },
    ],
    searchFields: ['subject', 'body'],
    filterFields: ['type', 'relatedType', 'relatedId', 'outcome'],
    sortFields: ['occurredAt', 'createdAt', 'type'],
    defaultSort: { field: 'occurredAt', dir: 'desc' },
    include: { user: personInclude },
    minRoleWrite: 'member',
    minRoleDelete: 'manager',
    ownerField: 'userId',
  },
  products: {
    model: 'product',
    label: 'Product',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'sku', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'unitPrice', type: 'number', default: 0 },
      { name: 'billingCycle', type: 'string', default: 'one_time' },
      { name: 'active', type: 'boolean', default: true },
      { name: 'description', type: 'string' },
    ],
    searchFields: ['name', 'sku', 'category', 'description'],
    filterFields: ['active', 'category', 'billingCycle'],
    sortFields: ['createdAt', 'name', 'unitPrice'],
    defaultSort: { field: 'createdAt', dir: 'desc' },
    minRoleWrite: 'manager',
    minRoleDelete: 'manager',
  },
  templates: {
    model: 'emailTemplate',
    label: 'Email template',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'subject', type: 'string', required: true },
      { name: 'body', type: 'string', required: true },
      { name: 'category', type: 'string', default: 'general' },
    ],
    searchFields: ['name', 'subject', 'body'],
    filterFields: ['category'],
    sortFields: ['createdAt', 'updatedAt', 'name'],
    defaultSort: { field: 'updatedAt', dir: 'desc' },
    minRoleWrite: 'member',
    minRoleDelete: 'manager',
  },
  workflows: {
    model: 'workflow',
    label: 'Workflow',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'description', type: 'string' },
      { name: 'trigger', type: 'string', default: 'lead.created' },
      { name: 'conditions', type: 'json', default: [] },
      { name: 'actions', type: 'json', default: [] },
      { name: 'active', type: 'boolean', default: true },
    ],
    searchFields: ['name', 'description'],
    filterFields: ['trigger', 'active'],
    sortFields: ['createdAt', 'runCount', 'name'],
    defaultSort: { field: 'createdAt', dir: 'desc' },
    minRoleWrite: 'manager',
    minRoleDelete: 'manager',
  },
  campaigns: {
    model: 'campaign',
    label: 'Campaign',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'templateId', type: 'string' },
      { name: 'segment', type: 'string', default: 'all' },
    ],
    searchFields: ['name'],
    filterFields: ['status', 'segment'],
    sortFields: ['createdAt', 'sentAt', 'name'],
    defaultSort: { field: 'createdAt', dir: 'desc' },
    include: { template: { select: { id: true, name: true, subject: true } } },
    minRoleWrite: 'manager',
    minRoleDelete: 'manager',
  },
}

export function getEntity(name: string): EntitySpec {
  const spec = ENTITIES[name]
  if (!spec) throw new ApiError(404, `Unknown module: ${name}`)
  return spec
}

export function modelDelegate(spec: EntitySpec) {
  return (db as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>)[spec.model]
}

// ── Payload coercion + validation ───────────────────────────────────────────

export function coerceField(spec: FieldSpec, value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  switch (spec.type) {
    case 'number': {
      const n = Number(value)
      if (Number.isNaN(n)) throw new ApiError(400, `"${spec.name}" must be a number`)
      return n
    }
    case 'boolean':
      return value === true || value === 'true' || value === 1
    case 'date': {
      const d = new Date(String(value))
      if (Number.isNaN(d.getTime())) throw new ApiError(400, `"${spec.name}" must be a valid date`)
      return d
    }
    case 'json': {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          throw new ApiError(400, `"${spec.name}" must be valid JSON`)
        }
      }
      return value
    }
    default:
      return String(value).slice(0, 20000)
  }
}

export function buildData(spec: EntitySpec, body: Record<string, unknown>, isCreate: boolean): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const f of spec.fields) {
    if (f.name in body) {
      let v = coerceField(f, body[f.name])
      // Non-nullable fields with defaults (status, stage, source…) must never be nulled:
      // on create fall back to the default; on update leave the current value untouched.
      if (v === null && f.default !== undefined) {
        if (isCreate) v = f.default
        else continue
      }
      if (v !== undefined) data[f.name] = v
    } else if (isCreate && f.default !== undefined) {
      data[f.name] = f.default
    }
  }
  if (isCreate) {
    for (const f of spec.fields) {
      if (f.required && (data[f.name] === null || data[f.name] === undefined || data[f.name] === '')) {
        throw new ApiError(400, `${spec.label}: "${f.name}" is required`)
      }
    }
    if (spec.ownerField && !data[spec.ownerField]) data[spec.ownerField] = null
  }
  return data
}

export function buildWhere(spec: EntitySpec, params: URLSearchParams, orgId: string): Record<string, unknown> {
  const where: Record<string, unknown> = { orgId }
  const q = params.get('q')?.trim()
  if (q) {
    where.OR = spec.searchFields.map((f) => ({ [f]: { contains: q } }))
  }
  for (const f of spec.filterFields) {
    const v = params.get(f)
    if (v !== null && v !== '') where[f] = v
  }
  return where
}

export function buildOrderBy(spec: EntitySpec, params: URLSearchParams) {
  const field = params.get('sort') ?? spec.defaultSort.field
  const dir = params.get('order') === 'asc' || params.get('order') === 'desc' ? params.get('order') : spec.defaultSort.dir
  const safeField = spec.sortFields.includes(field) ? field : spec.defaultSort.field
  return { [safeField]: dir }
}

// Deal stage → probability + close timestamp (business logic)
export const STAGE_PROBABILITY: Record<string, number> = {
  qualification: 20,
  needs_analysis: 40,
  value_prop: 60,
  negotiation: 80,
  closed_won: 100,
  closed_lost: 0,
}

export function applyDealRules(data: Record<string, unknown>, before?: Record<string, unknown>) {
  if (typeof data.stage === 'string') {
    const prob = STAGE_PROBABILITY[data.stage]
    if (prob !== undefined && data.probability === undefined) data.probability = prob
    if (data.stage === 'closed_won' || data.stage === 'closed_lost') {
      if (before?.stage !== data.stage) data.closedAt = new Date()
    }
  }
  return data
}
