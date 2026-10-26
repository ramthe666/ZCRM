import { db } from '@/lib/db'
import { ApiError, errorResponse, json, requireAuth } from '@/lib/auth'
import { audit } from '@/lib/events'

// ── Integration management ──────────────────────────────────────────────────
// GET    → all known providers with connection state (secrets masked)
// POST   → connect/update { provider, config }  (admin)
// DELETE → disconnect ?provider=  (admin)

export const PROVIDERS: Record<string, { name: string; category: string; blurb: string; fields: { key: string; label: string; placeholder?: string; secret?: boolean }[] }> = {
  supabase: {
    name: 'Supabase',
    category: 'Database',
    blurb: 'Managed Postgres, auth and storage with row-level security.',
    fields: [
      { key: 'projectUrl', label: 'Project URL', placeholder: 'https://xxxx.supabase.co' },
      { key: 'anonKey', label: 'Anon key', secret: true },
      { key: 'serviceKey', label: 'Service role key', secret: true },
    ],
  },
  vercel: {
    name: 'Vercel',
    category: 'Hosting',
    blurb: 'Deploy Nova CRM with zero-config CI/CD and edge network.',
    fields: [{ key: 'token', label: 'Access token', secret: true }],
  },
  github: {
    name: 'GitHub',
    category: 'Dev tools',
    blurb: 'Sync issues, link repositories and track engineering touchpoints.',
    fields: [
      { key: 'token', label: 'Personal access token', secret: true },
      { key: 'repo', label: 'Default repository', placeholder: 'acme/nova-crm' },
    ],
  },
  resend: {
    name: 'Resend',
    category: 'Email',
    blurb: 'Transactional email + campaign delivery for the CRM.',
    fields: [
      { key: 'apiKey', label: 'API key', secret: true },
      { key: 'fromEmail', label: 'From email', placeholder: 'sales@yourdomain.com' },
    ],
  },
  whatsapp: {
    name: 'WhatsApp Business',
    category: 'Messaging',
    blurb: 'Click-to-chat and template messages straight from contact records.',
    fields: [
      { key: 'phoneNumberId', label: 'Phone number ID' },
      { key: 'token', label: 'Access token', secret: true },
      { key: 'verifyTemplate', label: 'Verify template name', placeholder: 'hello_world' },
    ],
  },
  slack: {
    name: 'Slack',
    category: 'Collaboration',
    blurb: 'Push deal-won alerts and daily digests to your channels.',
    fields: [{ key: 'webhookUrl', label: 'Incoming webhook URL', secret: true }],
  },
  stripe: {
    name: 'Stripe',
    category: 'Payments',
    blurb: 'Usage-based billing, invoices and dunning for your customers.',
    fields: [{ key: 'secretKey', label: 'Secret key', secret: true }],
  },
  zapier: {
    name: 'Zapier',
    category: 'Automation',
    blurb: 'Connect Nova to 6,000+ apps with zaps and webhooks.',
    fields: [{ key: 'webhookUrl', label: 'Zap webhook URL', secret: true }],
  },
  google: {
    name: 'Google Workspace',
    category: 'Productivity',
    blurb: 'Gmail send-as, Calendar sync and Contact import.',
    fields: [
      { key: 'clientId', label: 'OAuth client ID', secret: true },
      { key: 'clientSecret', label: 'OAuth client secret', secret: true },
    ],
  },
  mailchimp: {
    name: 'Mailchimp',
    category: 'Marketing',
    blurb: 'Sync audiences and campaign stats both ways.',
    fields: [{ key: 'apiKey', label: 'API key', secret: true }],
  },
  twilio: {
    name: 'Twilio',
    category: 'Voice & SMS',
    blurb: 'Click-to-call and SMS directly from contact cards.',
    fields: [
      { key: 'accountSid', label: 'Account SID' },
      { key: 'authToken', label: 'Auth token', secret: true },
    ],
  },
  hubspot: {
    name: 'HubSpot',
    category: 'Migration',
    blurb: 'One-click import of contacts, companies and deals.',
    fields: [{ key: 'apiKey', label: 'Private app token', secret: true }],
  },
}

function maskConfig(config: string): Record<string, string> {
  try {
    const parsed = JSON.parse(config) as Record<string, string>
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (!v) continue
      out[k] = k.toLowerCase().includes('key') || k.toLowerCase().includes('token') || k.toLowerCase().includes('secret')
        ? `${String(v).slice(0, 4)}••••${String(v).slice(-4)}`
        : v
    }
    return out
  } catch {
    return {}
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    const integrations = await db.integration.findMany({ where: { orgId: auth.org.id } })
    const byProvider = new Map(integrations.map((i) => [i.provider, i]))

    const providers = Object.entries(PROVIDERS).map(([key, meta]) => {
      const record = byProvider.get(key)
      return {
        provider: key,
        ...meta,
        connected: !!record && record.status !== 'disabled',
        status: record?.status ?? null,
        connectedAt: record?.connectedAt ?? null,
        config: record ? maskConfig(record.config) : null,
      }
    })
    return json({ providers })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, 'admin')
    const body = (await req.json().catch(() => ({}))) as { provider?: string; config?: Record<string, string> }
    const provider = body.provider ?? ''
    const meta = PROVIDERS[provider]
    if (!meta) throw new ApiError(404, 'Unknown integration provider')

    // Keep only known fields, strip empties
    const config: Record<string, string> = {}
    for (const f of meta.fields) {
      const v = body.config?.[f.key]
      if (v && String(v).trim()) config[f.key] = String(v).trim()
    }
    if (Object.keys(config).length === 0) throw new ApiError(400, 'Provide at least one credential')

    const record = await db.integration.upsert({
      where: { orgId_provider: { orgId: auth.org.id, provider } },
      create: { orgId: auth.org.id, provider, config: JSON.stringify(config), status: 'connected' },
      update: {
        orgId: auth.org.id,
        provider,
        config: JSON.stringify(config),
        status: 'connected',
        connectedAt: new Date(),
      },
    })

    await audit(auth.org.id, auth.user.id, 'connect', 'integration', record.id, `Connected ${meta.name}`)
    return json({ integration: { ...record, config: JSON.stringify(maskConfig(record.config)) } }, 201)
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth(req, 'admin')
    const provider = new URL(req.url).searchParams.get('provider') ?? ''
    if (!PROVIDERS[provider]) throw new ApiError(404, 'Unknown integration provider')

    await db.integration.deleteMany({ where: { orgId: auth.org.id, provider } })
    await audit(auth.org.id, auth.user.id, 'disconnect', 'integration', provider, `Disconnected ${PROVIDERS[provider].name}`)
    return json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
