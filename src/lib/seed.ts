import { db } from '@/lib/db'

// Sample data seeding — used on signup (light) and for the demo account (rich).
// Every record is org-scoped and owned by the provided owner.

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000)
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000)

export async function seedOrgData(orgId: string, ownerId: string, rich = false) {
  // ── Accounts ──────────────────────────────────────────────────────────────
  const accountsData = [
    { name: 'Helios Energy', website: 'heliosenergy.com', phone: '+1 512 555 0142', industry: 'Renewable Energy', size: '201-1000', tier: 'gold', city: 'Austin', country: 'United States', revenue: 45000000, notes: 'Expanding to 3 new states next quarter.' },
    { name: 'Quantia Finance', website: 'quantia.fi', phone: '+1 212 555 0188', industry: 'Financial Services', size: '1000+', tier: 'platinum', city: 'New York', country: 'United States', revenue: 120000000, notes: 'Security review required for all vendors.' },
    { name: 'Northbeam Logistics', website: 'northbeam.io', phone: '+31 10 555 0173', industry: 'Logistics', size: '201-1000', tier: 'silver', city: 'Rotterdam', country: 'Netherlands', revenue: 22000000, notes: 'EU data residency preferred.' },
    { name: 'Lumen Labs', website: 'lumenlabs.bio', phone: '+1 617 555 0119', industry: 'Biotech', size: '51-200', tier: 'standard', city: 'Boston', country: 'United States', revenue: 8000000, notes: 'Grant-funded — price sensitive.' },
    { name: 'Vertexa Media', website: 'vertexa.media', phone: '+44 20 5550 0155', industry: 'Media & Entertainment', size: '201-1000', tier: 'gold', city: 'London', country: 'United Kingdom', revenue: 31000000, notes: null },
    { name: 'Orbit Health', website: 'orbithealth.ca', phone: '+1 416 555 0164', industry: 'Healthcare', size: '201-1000', tier: 'silver', city: 'Toronto', country: 'Canada', revenue: 17000000, notes: 'HIPAA compliance questionnaire completed.' },
    ...(rich
      ? [
          { name: 'Cedar & Co', website: 'cedarandco.com.au', phone: '+61 2 5550 0131', industry: 'Retail', size: '51-200', tier: 'standard', city: 'Sydney', country: 'Australia', revenue: 6000000, notes: null },
          { name: 'Brightline Retail', website: 'brightlineretail.com', phone: '+1 312 555 0126', industry: 'Retail', size: '1000+', tier: 'platinum', city: 'Chicago', country: 'United States', revenue: 88000000, notes: 'Evaluate against legacy Zoho deployment.' },
        ]
      : []),
  ]
  const accounts: Record<string, string> = {}
  for (const a of accountsData) {
    const created = await db.account.create({ data: { ...a, orgId, ownerId, createdAt: daysAgo(120 + Math.random() * 60) } })
    accounts[a.name] = created.id
  }

  // ── Contacts ──────────────────────────────────────────────────────────────
  const contactsData = [
    { firstName: 'Ava', lastName: 'Thompson', email: 'ava.thompson@heliosenergy.com', phone: '+1 512 555 0143', title: 'VP Operations', account: 'Helios Energy', lifecycle: 'customer', source: 'referral' },
    { firstName: 'Liam', lastName: 'Rodriguez', email: 'liam.rodriguez@quantia.fi', phone: '+1 212 555 0189', title: 'Head of IT', account: 'Quantia Finance', lifecycle: 'customer', source: 'event' },
    { firstName: 'Sofia', lastName: 'Martinez', email: 'sofia.martinez@northbeam.io', phone: '+31 10 555 0174', title: 'COO', account: 'Northbeam Logistics', lifecycle: 'customer', source: 'website' },
    { firstName: 'Noah', lastName: 'Kim', email: 'noah.kim@lumenlabs.bio', phone: '+1 617 555 0120', title: 'Lab Director', account: 'Lumen Labs', lifecycle: 'sales_qualified', source: 'ads' },
    { firstName: 'Emma', lastName: 'Wilson', email: 'emma.wilson@vertexa.media', phone: '+44 20 5550 0156', title: 'Commercial Director', account: 'Vertexa Media', lifecycle: 'sales_qualified', source: 'partner' },
    { firstName: 'Raj', lastName: 'Patel', email: 'raj.patel@orbithealth.ca', phone: '+1 416 555 0165', title: 'CIO', account: 'Orbit Health', lifecycle: 'marketing_qualified', source: 'social' },
    ...(rich
      ? [
          { firstName: 'Mia', lastName: 'Chen', email: 'mia.chen@cedarandco.com.au', phone: '+61 2 5550 0132', title: 'Founder', account: 'Cedar & Co', lifecycle: 'lead', source: 'cold_call' },
          { firstName: 'Lucas', lastName: 'Weber', email: 'lucas.weber@brightlineretail.com', phone: '+1 312 555 0127', title: 'SVP Digital', account: 'Brightline Retail', lifecycle: 'sales_qualified', source: 'referral' },
          { firstName: 'Olivia', lastName: 'Brown', email: 'olivia.brown@heliosenergy.com', phone: '+1 512 555 0144', title: 'Procurement Lead', account: 'Helios Energy', lifecycle: 'customer', source: 'referral' },
          { firstName: 'Ethan', lastName: 'Diaz', email: 'ethan.diaz@quantia.fi', phone: '+1 212 555 0190', title: 'Security Architect', account: 'Quantia Finance', lifecycle: 'customer', source: 'event' },
          { firstName: 'Isabella', lastName: 'Rossi', email: 'isabella.rossi@vertexa.media', phone: '+44 20 5550 0157', title: 'Partnerships Manager', account: 'Vertexa Media', lifecycle: 'marketing_qualified', source: 'website' },
          { firstName: 'Arjun', lastName: 'Mehta', email: 'arjun.mehta@orbithealth.ca', phone: '+1 416 555 0166', title: 'Head of Engineering', account: 'Orbit Health', lifecycle: 'customer', source: 'social' },
        ]
      : []),
  ]
  const contacts: Record<string, string> = {}
  for (const c of contactsData) {
    const { account, ...rest } = c
    const created = await db.contact.create({
      data: { ...rest, accountId: accounts[account] ?? null, orgId, ownerId, createdAt: daysAgo(90 + Math.random() * 50) },
    })
    contacts[`${c.firstName} ${c.lastName}`] = created.id
  }

  // ── Leads ─────────────────────────────────────────────────────────────────
  const leadsData = [
    { firstName: 'Chloe', lastName: 'Dubois', email: 'chloe@atelier-nine.fr', phone: '+33 1 5550 0121', company: 'Atelier Nine', title: 'Creative Director', source: 'ads', status: 'new', value: 15000, createdAt: daysAgo(3) },
    { firstName: 'Hannah', lastName: 'Liu', email: 'hannah.liu@stackforge.dev', phone: '+1 206 555 0117', company: 'StackForge', title: 'CTO', source: 'website', status: 'new', value: 42000, createdAt: daysAgo(5) },
    { firstName: 'Marcus', lastName: 'Hale', email: 'marcus@granitebuild.com', phone: '+1 602 555 0192', company: 'Granite Build', title: 'Owner', source: 'cold_call', status: 'contacted', value: 8000, createdAt: daysAgo(9) },
    { firstName: 'Yuki', lastName: 'Tanaka', email: 'yuki.tanaka@sakuralabs.jp', phone: '+81 3 5550 0187', company: 'Sakura Labs', title: 'GM', source: 'partner', status: 'contacted', value: 55000, createdAt: daysAgo(14) },
    { firstName: 'Diego', lastName: 'Fernandes', email: 'diego@coastalcraft.co', phone: '+55 11 5550 0123', company: 'CoastalCraft', title: 'Head of Sales', source: 'social', status: 'qualified', value: 31000, createdAt: daysAgo(20) },
    { firstName: 'Amara', lastName: 'Okafor', email: 'amara@solarisgrid.africa', phone: '+234 1 555 0134', company: 'Solaris Grid', title: 'Procurement', source: 'referral', status: 'qualified', value: 68000, createdAt: daysAgo(26) },
    { firstName: 'Tomas', lastName: 'Novak', email: 'tomas@brno-tools.cz', phone: '+420 2 5550 0118', company: 'Brno Tools', title: 'CEO', source: 'event', status: 'unqualified', value: 2000, createdAt: daysAgo(32) },
    { firstName: 'Grace', lastName: 'Miller', email: 'grace@willowlegal.com', phone: '+1 415 555 0139', company: 'Willow Legal', title: 'Managing Partner', source: 'website', status: 'unqualified', value: 5000, createdAt: daysAgo(40) },
    ...(rich
      ? [
          { firstName: 'Nina', lastName: 'Petrova', email: 'nina@balticsys.lv', phone: '+371 6 555 0145', company: 'Baltic Systems', title: 'Ops Lead', source: 'ads', status: 'new', value: 22000, createdAt: daysAgo(1) },
          { firstName: 'Omar', lastName: 'Haddad', email: 'omar@dunefreight.ae', phone: '+971 4 555 0128', company: 'Dune Freight', title: 'Director', source: 'referral', status: 'contacted', value: 95000, createdAt: daysAgo(11) },
        ]
      : []),
  ]
  for (const l of leadsData) {
    await db.lead.create({ data: { ...l, orgId, ownerId } })
  }

  // ── Deals (spread over 7 months for meaningful charts) ────────────────────
  const dealsData = [
    { name: 'Helios Energy — Platform Rollout', account: 'Helios Energy', contact: 'Ava Thompson', amount: 120000, stage: 'closed_won', probability: 100, createdAt: daysAgo(200), expectedCloseAt: daysAgo(160), closedAt: daysAgo(155), source: 'referral' },
    { name: 'Quantia Finance — Enterprise License', account: 'Quantia Finance', contact: 'Liam Rodriguez', amount: 85000, stage: 'closed_won', probability: 100, createdAt: daysAgo(140), expectedCloseAt: daysAgo(105), closedAt: daysAgo(100), source: 'event' },
    { name: 'Northbeam — Pilot Program', account: 'Northbeam Logistics', contact: 'Sofia Martinez', amount: 24000, stage: 'closed_won', probability: 100, createdAt: daysAgo(80), expectedCloseAt: daysAgo(62), closedAt: daysAgo(60), source: 'website' },
    { name: 'Orbit Health — Support Plan', account: 'Orbit Health', contact: 'Raj Patel', amount: 8000, stage: 'closed_lost', probability: 0, createdAt: daysAgo(45), expectedCloseAt: daysAgo(32), closedAt: daysAgo(30), source: 'social' },
    { name: 'Vertexa Media — Expansion Pack', account: 'Vertexa Media', contact: 'Emma Wilson', amount: 45000, stage: 'negotiation', probability: 80, createdAt: daysAgo(38), expectedCloseAt: daysFromNow(12), closedAt: null, source: 'partner' },
    { name: 'Orbit Health — Platform License', account: 'Orbit Health', contact: 'Raj Patel', amount: 67000, stage: 'value_prop', probability: 60, createdAt: daysAgo(30), expectedCloseAt: daysFromNow(21), closedAt: null, source: 'social' },
    { name: 'Brightline — Multi-region Deployment', account: 'Brightline Retail', contact: 'Lucas Weber', amount: 150000, stage: 'negotiation', probability: 80, createdAt: daysAgo(26), expectedCloseAt: daysFromNow(18), closedAt: null, source: 'referral' },
    { name: 'Lumen Labs — Starter Plan', account: 'Lumen Labs', contact: 'Noah Kim', amount: 12000, stage: 'needs_analysis', probability: 40, createdAt: daysAgo(18), expectedCloseAt: daysFromNow(25), closedAt: null, source: 'ads' },
    { name: 'Helios Energy — Add-on Modules', account: 'Helios Energy', contact: 'Olivia Brown', amount: 38000, stage: 'qualification', probability: 20, createdAt: daysAgo(10), expectedCloseAt: daysFromNow(35), closedAt: null, source: 'referral' },
    { name: 'Quantia Finance — Renewal 2025', account: 'Quantia Finance', contact: 'Liam Rodriguez', amount: 90000, stage: 'value_prop', probability: 60, createdAt: daysAgo(8), expectedCloseAt: daysFromNow(28), closedAt: null, source: 'event' },
    ...(rich
      ? [
          { name: 'Northbeam — Fleet Analytics', account: 'Northbeam Logistics', contact: 'Sofia Martinez', amount: 28000, stage: 'needs_analysis', probability: 40, createdAt: daysAgo(6), expectedCloseAt: daysFromNow(30), closedAt: null, source: 'website' },
          { name: 'Vertexa Media — Ad Suite', account: 'Vertexa Media', contact: 'Isabella Rossi', amount: 19000, stage: 'qualification', probability: 20, createdAt: daysAgo(2), expectedCloseAt: daysFromNow(40), closedAt: null, source: 'partner' },
        ]
      : []),
  ]
  for (const d of dealsData) {
    const { account, contact, ...rest } = d
    await db.deal.create({
      data: { ...rest, accountId: accounts[account] ?? null, contactId: contacts[contact] ?? null, orgId, ownerId },
    })
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const tasksData = [
    { title: 'Send revised proposal to Vertexa Media', description: 'Include multi-year discount table.', status: 'in_progress', priority: 'high', dueAt: daysFromNow(1), relatedType: 'deal' },
    { title: 'Security questionnaire for Quantia renewal', description: 'Work with Ethan Diaz on SOC2 answers.', status: 'not_started', priority: 'urgent', dueAt: daysFromNow(3), relatedType: 'deal' },
    { title: 'Onboarding call with Northbeam', description: 'Walk through data import and user setup.', status: 'completed', priority: 'normal', dueAt: daysAgo(2), relatedType: 'account' },
    { title: 'Follow up with Hannah Liu (StackForge)', description: 'She asked for a technical deep-dive.', status: 'not_started', priority: 'high', dueAt: daysFromNow(0), relatedType: 'lead' },
    { title: 'Prepare QBR deck for Helios Energy', description: null, status: 'not_started', priority: 'normal', dueAt: daysFromNow(7), relatedType: 'account' },
    { title: 'Demo Brightline stakeholders', description: 'Multi-region architecture walkthrough.', status: 'in_progress', priority: 'urgent', dueAt: daysFromNow(2), relatedType: 'deal' },
    ...(rich
      ? [
          { title: 'Call Amara Okafor about Solaris Grid pilot', description: 'Referral from Ava Thompson.', status: 'not_started', priority: 'high', dueAt: daysFromNow(1), relatedType: 'lead' },
          { title: 'Send contract to Lumen Labs', description: 'Grant-friendly payment terms.', status: 'not_started', priority: 'normal', dueAt: daysFromNow(4), relatedType: 'deal' },
          { title: 'Update CRM hygiene notes', description: 'Close stale opportunities.', status: 'deferred', priority: 'low', dueAt: daysFromNow(14), relatedType: null },
          { title: 'Invite Orbit Health team to workspace', description: 'Raj wants 3 extra seats.', status: 'in_progress', priority: 'normal', dueAt: daysFromNow(2), relatedType: 'account' },
          { title: 'Log Q2 call outcomes', description: null, status: 'completed', priority: 'low', dueAt: daysAgo(5), relatedType: null },
          { title: 'Draft Sakura Labs partnership terms', description: 'Yuki Tanaka intro from Vertexa.', status: 'not_started', priority: 'normal', dueAt: daysFromNow(6), relatedType: 'lead' },
        ]
      : []),
  ]
  for (const t of tasksData) {
    await db.task.create({
      data: { ...t, relatedId: null, orgId, assigneeId: ownerId, createdAt: daysAgo(10 + Math.random() * 20) },
    })
  }

  // ── Activities ────────────────────────────────────────────────────────────
  const activitiesData = [
    { type: 'call', subject: 'Discovery call — Vertexa expansion', outcome: 'interested', durationMin: 45, occurredAt: daysAgo(12), body: 'Emma wants to add 40 seats before the media season.' },
    { type: 'meeting', subject: 'Onboarding kickoff — Northbeam', outcome: 'scheduled', durationMin: 60, occurredAt: daysAgo(9), body: 'Data migration plan agreed. Go-live in 2 weeks.' },
    { type: 'note', subject: 'Competitive intel — Brightline', outcome: null, durationMin: null, occurredAt: daysAgo(7), body: 'Currently evaluating against Zoho. Price + EU hosting are the deciding factors.' },
    { type: 'call', subject: 'Pricing follow-up — Lumen Labs', outcome: 'no_answer', durationMin: 5, occurredAt: daysAgo(5), body: 'Left voicemail, will retry Thursday.' },
    { type: 'email', subject: 'Sent security pack to Quantia', outcome: null, durationMin: null, occurredAt: daysAgo(4), body: 'SOC2 report + pen-test summary attached.' },
    ...(rich
      ? [
          { type: 'meeting', subject: 'Executive demo — Orbit Health board', outcome: 'interested', durationMin: 90, occurredAt: daysAgo(15), body: 'CIO loved the forecasting view.' },
          { type: 'call', subject: 'Renewal talk — Liam Rodriguez', outcome: 'connected', durationMin: 30, occurredAt: daysAgo(11), body: 'Wants to bundle premium support into renewal.' },
          { type: 'whatsapp', subject: 'Quick question from Sofia Martinez', outcome: null, durationMin: null, occurredAt: daysAgo(3), body: 'Asked about bulk import limits — answered with docs link.' },
          { type: 'note', subject: 'Helios expansion signals', outcome: null, durationMin: null, occurredAt: daysAgo(2), body: 'Olivia mentioned 2 new business units launching Q3.' },
          { type: 'call', subject: 'Lost-deal review — Orbit support plan', outcome: 'not_interested', durationMin: 15, occurredAt: daysAgo(28), body: 'They chose an in-house solution for tier-1 support.' },
        ]
      : []),
  ]
  for (const a of activitiesData) {
    await db.activity.create({ data: { ...a, orgId, userId: ownerId } })
  }

  // ── Products ──────────────────────────────────────────────────────────────
  const productsData = [
    { name: 'Nova Starter (per seat)', sku: 'NOVA-ST', category: 'Subscription', unitPrice: 14, billingCycle: 'monthly', description: 'Core CRM for individuals.' },
    { name: 'Nova Standard (per seat)', sku: 'NOVA-STD', category: 'Subscription', unitPrice: 39, billingCycle: 'monthly', description: 'Automation + campaigns for teams.' },
    { name: 'Nova Professional (per seat)', sku: 'NOVA-PRO', category: 'Subscription', unitPrice: 79, billingCycle: 'monthly', description: 'Advanced analytics and API access.' },
    { name: 'Onboarding & Migration', sku: 'SVC-ONB', category: 'Service', unitPrice: 1500, billingCycle: 'one_time', description: 'Guided migration from any CRM.' },
    { name: 'Premium Support', sku: 'SVC-SUP', category: 'Service', unitPrice: 500, billingCycle: 'monthly', description: '1-hour SLA, dedicated success manager.' },
  ]
  for (const p of productsData) {
    await db.product.create({ data: { ...p, orgId } })
  }

  // ── Email templates ───────────────────────────────────────────────────────
  const templatesData = [
    { name: 'Warm welcome', subject: 'Welcome to {{name}} — let’s get you set up', body: 'Hi {{name}},\n\nThanks for joining Nova CRM. I’m here to help you import your data and set up your first pipeline.\n\nBest,\nThe Nova Team', category: 'onboarding' },
    { name: 'Post-demo follow-up', subject: 'Great talking with you, {{name}}', body: 'Hi {{name}},\n\nAs promised, here’s the recap of today’s demo and the pricing we discussed. Happy to answer any questions.\n\nBest,', category: 'sales' },
    { name: 'Monthly product newsletter', subject: 'What’s new in Nova — this month', body: 'Hello {{name}},\n\nThis month we shipped forecasting, WhatsApp messaging and faster search.\n\n— Nova CRM', category: 'marketing' },
  ]
  for (const t of templatesData) {
    await db.emailTemplate.create({ data: { ...t, orgId } })
  }

  // ── Workflows ─────────────────────────────────────────────────────────────
  const workflowsData = [
    {
      name: 'Ad lead → 24h follow-up',
      description: 'When a lead arrives from paid ads, create an urgent call task and notify the owner.',
      trigger: 'lead.created',
      conditions: JSON.stringify([{ field: 'source', operator: 'eq', value: 'ads' }]),
      actions: JSON.stringify([
        { type: 'create_task', config: { title: 'Call new ad lead {{name}} within 24h', dueInDays: 1, priority: 'high', description: 'Auto-created: ad-sourced lead needs fast qualification.' } },
        { type: 'notify', config: { title: 'New ad-sourced lead: {{name}}', body: 'A paid-ads lead just landed in your pipeline.' } },
      ]),
      active: true,
    },
    {
      name: 'Won deal — onboarding kit',
      description: 'When a deal is marked Closed Won, notify the owner and schedule the kickoff task.',
      trigger: 'deal.stage_changed',
      conditions: JSON.stringify([{ field: 'stage', operator: 'eq', value: 'closed_won' }]),
      actions: JSON.stringify([
        { type: 'notify', config: { title: '🎉 Deal won: {{name}}', body: 'Time to schedule onboarding!' } },
        { type: 'create_task', config: { title: 'Send onboarding kit for {{name}}', dueInDays: 2, priority: 'high' } },
      ]),
      active: true,
    },
    {
      name: 'Hot deal alert (negotiation)',
      description: 'Notify the owner when a deal enters Negotiation.',
      trigger: 'deal.stage_changed',
      conditions: JSON.stringify([{ field: 'stage', operator: 'eq', value: 'negotiation' }]),
      actions: JSON.stringify([{ type: 'notify', config: { title: '🔥 {{name}} moved to Negotiation', body: 'Review approval options before the next call.' } }]),
      active: false,
    },
  ]
  for (const w of workflowsData) {
    await db.workflow.create({ data: { ...w, orgId, runCount: Math.floor(Math.random() * 24) } })
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────
  const [newsletterTpl, followUpTpl] = await db.emailTemplate.findMany({ where: { orgId }, take: 2 })
  await db.campaign.create({
    data: { orgId, name: 'June product newsletter', templateId: newsletterTpl?.id ?? null, segment: 'all', status: 'sent', recipientCount: 6, sentCount: 6, openCount: 4, clickCount: 2, sentAt: daysAgo(18) },
  })
  await db.campaign.create({
    data: { orgId, name: 'Q3 re-engagement', templateId: followUpTpl?.id ?? null, segment: 'prospects', status: 'draft' },
  })

  // ── Invoices ──────────────────────────────────────────────────────────────
  const invoicesData = [
    { number: 'NOVA-2025-0042', plan: 'standard', amount: 156, date: daysAgo(95), status: 'paid' },
    { number: 'NOVA-2025-0058', plan: 'standard', amount: 156, date: daysAgo(64), status: 'paid' },
    { number: 'NOVA-2025-0071', plan: 'standard', amount: 156, date: daysAgo(34), status: 'paid' },
    { number: 'NOVA-2025-0089', plan: 'standard', amount: 156, date: daysAgo(4), status: 'open' },
  ]
  for (const inv of invoicesData) {
    await db.invoice.create({ data: { ...inv, orgId, cycle: 'monthly', seats: 4, dueAt: daysFromNow(10) } })
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  await db.notification.createMany({
    data: [
      { orgId, userId: ownerId, title: 'Welcome to Nova CRM 👋', body: 'Sample data has been added so you can explore every module. Delete it anytime.', type: 'success' },
      { orgId, userId: ownerId, title: 'Brightline deal moved to Negotiation', body: '$150,000 Multi-region Deployment is in the final stage.', type: 'deal' },
      { orgId, userId: ownerId, title: 'Task due today', body: 'Follow up with Hannah Liu (StackForge).', type: 'task' },
    ],
  })

  // ── Audit ─────────────────────────────────────────────────────────────────
  await db.auditLog.createMany({
    data: [
      { orgId, userId: ownerId, action: 'create', entity: 'account', summary: 'Sample workspace initialized with starter data' },
      { orgId, userId: ownerId, action: 'create', entity: 'deal', summary: `Imported ${dealsData.length} sample deals` },
      { orgId, userId: ownerId, action: 'create', entity: 'workflow', summary: 'Installed 3 starter automation workflows' },
    ],
  })
}
