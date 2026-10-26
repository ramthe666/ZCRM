import { db } from '@/lib/db'
import { ApiError } from '@/lib/auth'

// ── Monetization: plan catalog + server-side enforcement ────────────────────

export interface PlanSpec {
  key: string
  name: string
  price: number // per user / month, billed monthly
  yearly: number // per user / month, billed yearly
  seats: number
  contacts: number
  workflows: number
  campaigns: number
  blurb: string
  features: string[]
}

export const PLANS: Record<string, PlanSpec> = {
  starter: {
    key: 'starter',
    name: 'Starter',
    price: 14,
    yearly: 11,
    seats: 3,
    contacts: 1000,
    workflows: 3,
    campaigns: 2,
    blurb: 'For individuals and tiny teams getting started with structured selling.',
    features: [
      'Up to 3 users',
      '1,000 contacts',
      'Deals pipeline & kanban',
      '3 automation workflows',
      '2 email campaigns / month',
      'CSV import & export',
    ],
  },
  standard: {
    key: 'standard',
    name: 'Standard',
    price: 39,
    yearly: 31,
    seats: 10,
    contacts: 10000,
    workflows: 10,
    campaigns: 10,
    blurb: 'For growing sales teams that need automation and shared pipelines.',
    features: [
      'Up to 10 users',
      '10,000 contacts',
      '10 automation workflows',
      'WhatsApp & call logging',
      'Email campaigns ×10 / month',
      'Custom reports & dashboards',
    ],
  },
  professional: {
    key: 'professional',
    name: 'Professional',
    price: 79,
    yearly: 63,
    seats: 25,
    contacts: 50000,
    workflows: 25,
    campaigns: 50,
    blurb: 'For scaling revenue orgs with advanced reporting and API access.',
    features: [
      'Up to 25 users',
      '50,000 contacts',
      '25 automation workflows',
      'Advanced analytics & forecasting',
      'API access & webhooks',
      'Priority support',
    ],
  },
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    price: 199,
    yearly: 159,
    seats: 1000000,
    contacts: 100000000,
    workflows: 1000000,
    campaigns: 1000000,
    blurb: 'For large orgs that need SSO, custom limits and white-glove support.',
    features: [
      'Unlimited users',
      'Unlimited contacts & workflows',
      'SSO / SAML & audit exports',
      'Dedicated success manager',
      'Custom data residency',
      '99.99% uptime SLA',
    ],
  },
}

export type LimitKind = 'seats' | 'contacts' | 'workflows' | 'campaigns'

export async function checkLimit(orgId: string, plan: string, kind: LimitKind) {
  const limits = PLANS[plan] ?? PLANS.starter
  if (limits[kind] >= 1000000) return
  const count =
    kind === 'contacts'
      ? await db.contact.count({ where: { orgId } })
      : kind === 'seats'
        ? await db.membership.count({ where: { orgId } })
        : kind === 'workflows'
          ? await db.workflow.count({ where: { orgId } })
          : await db.campaign.count({ where: { orgId } })
  if (count >= limits[kind]) {
    throw new ApiError(
      402,
      `${limits.name} plan limit reached (${count}/${limits[kind]} ${kind}). Upgrade in Billing → Plans to add more.`
    )
  }
}
