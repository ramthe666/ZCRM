// Demo workspace seeder — run with: bun prisma/seed.ts
// Creates a team of 4 with realistic sample data across every module.
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'

const db = new PrismaClient()

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

async function main() {
  const email = 'demo@novacrm.io'
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Demo user already exists — skipping seed. (Delete db/custom.db and re-run to reset.)')
    return
  }

  const owner = await db.user.create({
    data: { name: 'Alex Morgan', email, passwordHash: hashPassword('Demo1234!'), title: 'Head of Revenue', avatarColor: '#059669' },
  })
  const sarah = await db.user.create({
    data: { name: 'Sarah Chen', email: 'sarah@novacrm.io', passwordHash: hashPassword('Demo1234!'), title: 'Account Executive', avatarColor: '#0d9488' },
  })
  const marcus = await db.user.create({
    data: { name: 'Marcus Reid', email: 'marcus@novacrm.io', passwordHash: hashPassword('Demo1234!'), title: 'Sales Manager', avatarColor: '#d97706' },
  })
  const priya = await db.user.create({
    data: { name: 'Priya Sharma', email: 'priya@novacrm.io', passwordHash: hashPassword('Demo1234!'), title: 'SDR', avatarColor: '#e11d48' },
  })

  const org = await db.organization.create({
    data: { name: 'NimbusWorks', slug: 'nimbusworks', plan: 'professional', planStatus: 'active', billingEmail: 'billing@nimbusworks.io' },
  })

  await db.membership.createMany({
    data: [
      { userId: owner.id, orgId: org.id, role: 'owner', status: 'active' },
      { userId: sarah.id, orgId: org.id, role: 'admin', status: 'active' },
      { userId: marcus.id, orgId: org.id, role: 'manager', status: 'active' },
      { userId: priya.id, orgId: org.id, role: 'member', status: 'active' },
    ],
  })

  const { seedOrgData } = await import('../src/lib/seed')
  await seedOrgData(org.id, owner.id, true)

  // Spread ownership across the team for realistic reports
  const deals = await db.deal.findMany({ where: { orgId: org.id } })
  const members = [owner.id, sarah.id, marcus.id, priya.id]
  for (const [i, deal] of deals.entries()) {
    await db.deal.update({ where: { id: deal.id }, data: { ownerId: members[i % members.length] } })
  }
  const leads = await db.lead.findMany({ where: { orgId: org.id } })
  for (const [i, lead] of leads.entries()) {
    await db.lead.update({ where: { id: lead.id }, data: { ownerId: members[(i + 1) % members.length] } })
  }
  const contacts = await db.contact.findMany({ where: { orgId: org.id } })
  for (const [i, contact] of contacts.entries()) {
    await db.contact.update({ where: { id: contact.id }, data: { ownerId: members[(i + 2) % members.length] } })
  }
  const tasks = await db.task.findMany({ where: { orgId: org.id } })
  for (const [i, task] of tasks.entries()) {
    await db.task.update({ where: { id: task.id }, data: { assigneeId: members[i % members.length] } })
  }
  const accounts = await db.account.findMany({ where: { orgId: org.id } })
  for (const [i, account] of accounts.entries()) {
    await db.account.update({ where: { id: account.id }, data: { ownerId: members[(i + 3) % members.length] } })
  }

  await db.auditLog.createMany({
    data: [
      { orgId: org.id, userId: sarah.id, action: 'update', entity: 'deal', summary: 'Sarah Chen moved Brightline deal to Negotiation' },
      { orgId: org.id, userId: marcus.id, action: 'create', entity: 'campaign', summary: 'Marcus Reid created campaign "Q3 re-engagement"' },
      { orgId: org.id, userId: priya.id, action: 'create', entity: 'lead', summary: 'Priya Sharma logged 2 new inbound leads' },
    ],
  })

  console.log('✅ Demo workspace seeded:')
  console.log('   Sign in → demo@novacrm.io / Demo1234!')
  console.log(`   Org: ${org.name} (professional plan, 4 seats)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
