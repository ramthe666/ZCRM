import { db } from '@/lib/db'
import { ApiError, errorResponse, json, requireAuth } from '@/lib/auth'

// Global search across core entities (used by the ⌘K command palette).
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    const orgId = auth.org.id
    const q = (new URL(req.url).searchParams.get('q') ?? '').trim()
    if (q.length < 2) return json({ groups: [] })

    const [leads, contacts, accounts, deals, tasks] = await Promise.all([
      db.lead.findMany({
        where: { orgId, OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }, { company: { contains: q } }] },
        select: { id: true, firstName: true, lastName: true, email: true, company: true, status: true },
        take: 5,
      }),
      db.contact.findMany({
        where: { orgId, OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }] },
        select: { id: true, firstName: true, lastName: true, email: true, title: true },
        take: 5,
      }),
      db.account.findMany({
        where: { orgId, OR: [{ name: { contains: q } }, { website: { contains: q } }] },
        select: { id: true, name: true, industry: true, tier: true },
        take: 5,
      }),
      db.deal.findMany({
        where: { orgId, name: { contains: q } },
        select: { id: true, name: true, amount: true, stage: true },
        take: 5,
      }),
      db.task.findMany({
        where: { orgId, title: { contains: q } },
        select: { id: true, title: true, status: true, dueAt: true },
        take: 5,
      }),
    ])

    const groups = [
      {
        key: 'leads',
        label: 'Leads',
        items: leads.map((l) => ({ id: l.id, title: `${l.firstName} ${l.lastName}`, subtitle: l.company ?? l.email ?? l.status, entity: 'leads' })),
      },
      {
        key: 'contacts',
        label: 'Contacts',
        items: contacts.map((c) => ({ id: c.id, title: `${c.firstName} ${c.lastName}`, subtitle: c.title ?? c.email ?? '', entity: 'contacts' })),
      },
      {
        key: 'accounts',
        label: 'Accounts',
        items: accounts.map((a) => ({ id: a.id, title: a.name, subtitle: a.industry ?? a.tier, entity: 'accounts' })),
      },
      {
        key: 'deals',
        label: 'Deals',
        items: deals.map((d) => ({ id: d.id, title: d.name, subtitle: d.stage.replace('_', ' '), entity: 'deals' })),
      },
      {
        key: 'tasks',
        label: 'Tasks',
        items: tasks.map((t) => ({ id: t.id, title: t.title, subtitle: t.status.replace('_', ' '), entity: 'tasks' })),
      },
    ].filter((g) => g.items.length > 0)

    if (groups.length === 0) throw new ApiError(404, `No results for "${q}"`)
    return json({ groups })
  } catch (e) {
    return errorResponse(e)
  }
}
