import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, errorResponse, json, requireAuth } from '@/lib/auth'
import { audit } from '@/lib/events'

// POST /api/whatsapp — send a WhatsApp message to a phone number.
// Uses the WhatsApp Business (Meta Graph) API when the integration is
// configured; otherwise records the message in demo mode.
const schema = z.object({
  to: z.string().min(5).max(24),
  message: z.string().min(1).max(2000),
  contactId: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req)
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid input')
    const { to, message, contactId } = parsed.data

    const integration = await db.integration.findUnique({
      where: { orgId_provider: { orgId: auth.org.id, provider: 'whatsapp' } },
    })
    let config: Record<string, string> = {}
    try {
      config = integration ? JSON.parse(integration.config) : {}
    } catch {
      /* ignore */
    }

    let status: 'sent' | 'simulated' | 'error' = 'simulated'
    let detail = 'Demo mode — connect WhatsApp Business in Settings → Integrations to deliver for real. Message logged to the timeline.'

    if (config.token && config.phoneNumberId) {
      try {
        const r = await fetch(`https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to.replace(/[^\d+]/g, ''),
            type: 'text',
            text: { body: message },
          }),
          signal: AbortSignal.timeout(8000),
        })
        if (r.ok) {
          status = 'sent'
          detail = 'Delivered via WhatsApp Business API.'
        } else {
          status = 'error'
          detail = `WhatsApp API error (HTTP ${r.status}). Message logged locally.`
        }
      } catch {
        status = 'error'
        detail = 'Could not reach the WhatsApp API from this environment. Message logged locally.'
      }
    }

    await db.activity.create({
      data: {
        orgId: auth.org.id,
        userId: auth.user.id,
        type: 'whatsapp',
        subject: `WhatsApp → ${to}`,
        body: message,
        relatedType: contactId ? 'contact' : null,
        relatedId: contactId ?? null,
      },
    })

    await audit(auth.org.id, auth.user.id, 'send', 'whatsapp', contactId ?? null, `WhatsApp message to ${to} (${status})`)

    return json({ status, detail })
  } catch (e) {
    return errorResponse(e)
  }
}
