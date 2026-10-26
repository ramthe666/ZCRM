import { db } from '@/lib/db'
import { notify } from '@/lib/events'

// ── Workflow automation engine ──────────────────────────────────────────────
// Triggers fire from the generic CRUD API. Each active workflow whose
// conditions match the record executes its actions. Never throws.

export interface WorkflowEvent {
  type: string // e.g. 'lead.created' | 'deal.stage_changed'
  entity: string // 'lead' | 'deal' | 'contact' | 'account' | 'task'
  record: Record<string, unknown>
  before?: Record<string, unknown>
}

interface WorkflowCondition {
  field: string
  operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'contains'
  value: unknown
}

interface WorkflowAction {
  type: 'create_task' | 'notify' | 'send_email' | 'update_field' | 'assign_owner'
  config?: Record<string, unknown>
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function displayValue(key: string, record: Record<string, unknown>): string {
  if (key === 'name') {
    if (record.firstName) return [record.firstName, record.lastName].filter(Boolean).join(' ')
    if (record.name) return String(record.name)
    if (record.title) return String(record.title)
    return ''
  }
  const v = record[key]
  return v === null || v === undefined ? '' : String(v)
}

function interpolate(tpl: string, record: Record<string, unknown>): string {
  return tpl.replace(/{{\s*([\w.]+)\s*}}/g, (_, k) => displayValue(k, record))
}

function compare(actual: unknown, op: string, value: unknown): boolean {
  switch (op) {
    case 'ne':
      return String(actual ?? '') !== String(value ?? '')
    case 'gt':
      return Number(actual ?? 0) > Number(value ?? 0)
    case 'lt':
      return Number(actual ?? 0) < Number(value ?? 0)
    case 'contains':
      return String(actual ?? '')
        .toLowerCase()
        .includes(String(value ?? '').toLowerCase())
    case 'eq':
    default:
      return String(actual ?? '') === String(value ?? '')
  }
}

const UPDATABLE_FIELDS: Record<string, string[]> = {
  lead: ['status', 'source', 'ownerId', 'notes'],
  deal: ['stage', 'probability', 'ownerId', 'notes', 'source'],
  contact: ['lifecycle', 'ownerId', 'source', 'notes'],
  account: ['tier', 'ownerId', 'notes'],
  task: ['status', 'priority', 'assigneeId'],
}

const MODEL_BY_ENTITY: Record<string, string> = {
  lead: 'lead',
  deal: 'deal',
  contact: 'contact',
  account: 'account',
  task: 'task',
}

export async function runWorkflows(orgId: string, event: WorkflowEvent) {
  try {
    const flows = await db.workflow.findMany({ where: { orgId, active: true, trigger: event.type } })
    for (const flow of flows) {
      const conditions = parseJson<WorkflowCondition[]>(flow.conditions, [])
      const matches = conditions.every((c) => compare(event.record[c.field], c.operator ?? 'eq', c.value))
      if (!matches) continue

      const actions = parseJson<WorkflowAction[]>(flow.actions, [])
      for (const action of actions) {
        await executeAction(orgId, action, event).catch((e) => console.error('[workflow:action]', e))
      }

      await db.workflow
        .update({ where: { id: flow.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } })
        .catch(() => {})
    }
  } catch (e) {
    console.error('[workflow]', e)
  }
}

async function executeAction(orgId: string, action: WorkflowAction, event: WorkflowEvent) {
  const record = event.record
  const cfg = action.config ?? {}

  switch (action.type) {
    case 'create_task': {
      const title = interpolate(String(cfg.title ?? 'Follow up: {{name}}'), record)
      const dueInDays = Number(cfg.dueInDays ?? 3)
      const assignee = (record.ownerId ?? record.assigneeId) as string | undefined
      await db.task.create({
        data: {
          orgId,
          title,
          description: cfg.description
            ? interpolate(String(cfg.description), record)
            : 'Auto-created by workflow automation',
          priority: String(cfg.priority ?? 'normal'),
          dueAt: new Date(Date.now() + dueInDays * 86400000),
          relatedType: event.entity,
          relatedId: record.id ? String(record.id) : null,
          assigneeId: assignee ?? null,
        },
      })
      if (assignee) await notify(assignee, orgId, `New task assigned: ${title}`, 'Created by workflow automation', 'task')
      break
    }

    case 'notify': {
      const target = (record.ownerId ?? record.assigneeId) as string | undefined
      if (target) {
        await notify(
          target,
          orgId,
          interpolate(String(cfg.title ?? 'Update on {{name}}'), record),
          cfg.body ? interpolate(String(cfg.body), record) : undefined,
          'info'
        )
      }
      break
    }

    case 'send_email': {
      await db.activity.create({
        data: {
          orgId,
          type: 'email',
          subject: interpolate(String(cfg.subject ?? 'Email regarding {{name}}'), record),
          body: cfg.body
            ? interpolate(String(cfg.body), record)
            : 'Queued — will be delivered via Resend once connected in Settings → Integrations.',
          relatedType: event.entity,
          relatedId: record.id ? String(record.id) : null,
        },
      })
      break
    }

    case 'update_field':
    case 'assign_owner': {
      const entity = event.entity
      const model = MODEL_BY_ENTITY[entity]
      const field = action.type === 'assign_owner' ? 'ownerId' : String(cfg.field ?? '')
      if (!model || !record.id || !field) return
      if (!UPDATABLE_FIELDS[entity]?.includes(field)) return
      const value = action.type === 'assign_owner' ? cfg.userId ?? record.ownerId : cfg.value
      await (db as unknown as Record<string, { updateMany: (a: unknown) => Promise<unknown> }>)[model].updateMany({
        where: { id: String(record.id), orgId },
        data: { [field]: value ?? null },
      })
      break
    }
  }
}
