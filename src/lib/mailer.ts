// ── Transactional email — Resend REST API ───────────────────────────────────
// All outbound product email (team invitations, welcome messages) goes through
// here. When RESEND_API_KEY is not configured the app runs in "demo mode":
// sendMail() returns { delivered: false, mode: 'demo' } and callers surface a
// copy-link fallback instead of failing the request. Never throws.

export interface SendMailInput {
  to: string
  subject: string
  html: string
  text?: string
}

export interface SendMailResult {
  delivered: boolean
  mode: 'demo' | 'resend'
  error?: string
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Nova CRM <onboarding@resend.dev>'
const TIMEOUT_MS = 10_000

export async function sendMail({ to, subject, html, text }: SendMailInput): Promise<SendMailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { delivered: false, mode: 'demo' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? DEFAULT_FROM,
        to,
        subject,
        html,
        ...(text ? { text } : {}),
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      // Never log/echo secrets — only the status and a trimmed provider message.
      const detail = (await res.text().catch(() => '')).slice(0, 300)
      console.error(`[mailer] Resend rejected the request (HTTP ${res.status})`, detail)
      return { delivered: false, mode: 'resend', error: `Resend responded with HTTP ${res.status}` }
    }
    return { delivered: true, mode: 'resend' }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown mailer error'
    console.error('[mailer] send failed:', message)
    return { delivered: false, mode: 'resend', error: message }
  } finally {
    clearTimeout(timer)
  }
}

// The public base URL of the app, used in emails and invite links.
// Resolution order:
//   1. APP_URL env (set it to your production domain on Vercel, no trailing slash)
//   2. the origin of the current request (x-forwarded-host/proto — works on
//      Vercel preview + production even when APP_URL is not configured)
//   3. http://localhost:3000 for local dev
export function appBaseUrl(req?: Request): string {
  const fromEnv = process.env.APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  if (req) {
    try {
      const url = new URL(req.url)
      const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host
      const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
      return `${proto}://${host}`
    } catch {
      /* fall through */
    }
  }
  return 'http://localhost:3000'
}

// The shareable invite link the email CTA (and the demo-mode copy fallback) uses.
export function inviteUrl(token: string, req?: Request): string {
  return `${appBaseUrl(req)}/?invite=${token}`
}

// ── Templates ───────────────────────────────────────────────────────────────
// Design language: white card on a soft slate canvas, emerald (#10b981) /
// teal accents, table-based layout with pure inline CSS (email-client safe —
// no external images, fonts or stylesheets).

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

export function renderEmailShell({
  title,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  footerNote,
}: {
  title: string
  bodyHtml: string
  ctaLabel?: string
  ctaUrl?: string
  footerNote?: string
}): string {
  const cta =
    ctaLabel && ctaUrl
      ? `
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:32px auto 8px auto;">
                <tr>
                  <td style="border-radius:10px;background:#059669;" align="center">
                    <a href="${ctaUrl}" style="display:inline-block;padding:14px 36px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#94a3b8;text-align:center;word-break:break-all;">
                Or paste this link into your browser:<br />
                <a href="${ctaUrl}" style="color:#0d9488;text-decoration:none;">${ctaUrl}</a>
              </p>`
      : ''

  const note = footerNote
    ? `
              <p style="margin:24px 0 0 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#64748b;text-align:center;">
                ${footerNote}
              </p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#eef2f6;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#eef2f6;">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="width:560px;max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
            <!-- Emerald / teal brand header -->
            <tr>
              <td style="background:#10b981;padding:26px 40px;" align="left">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:bold;color:#ffffff;letter-spacing:0.2px;">
                      Nova&nbsp;CRM<span style="color:#0f766e;">.</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="height:4px;background:#14b8a6;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:36px 40px 8px 40px;">
                <h1 style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:30px;color:#0f172a;font-weight:bold;">
                  ${title}
                </h1>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:25px;color:#334155;">
                  ${bodyHtml}
                </div>
                ${cta}
                ${note}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:28px 40px 30px 40px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#94a3b8;text-align:center;">
                  © 2025 Nova CRM — the calm, fast CRM for revenue teams.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function teamInviteEmail({
  orgName,
  inviterName,
  role,
  inviteUrl,
  expiresAt,
}: {
  orgName: string
  inviterName: string
  role: string
  inviteUrl: string
  expiresAt: Date
}): { subject: string; html: string; text: string } {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)
  const bodyHtml = `
                <p style="margin:0 0 16px 0;">Hi there,</p>
                <p style="margin:0 0 16px 0;">
                  <strong style="color:#0f172a;">${inviterName}</strong> has invited you to join
                  <strong style="color:#0f172a;">${orgName}</strong> on Nova CRM — a shared workspace for your
                  pipeline, contacts, deals and automation.
                </p>
                <p style="margin:0 0 24px 0;">
                  Your access level:
                  <span style="display:inline-block;margin-left:6px;padding:3px 12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;font-size:13px;font-weight:bold;color:#047857;">
                    ${roleLabel}
                  </span>
                </p>`
  const footerNote = `This invitation expires on ${fmtDate(expiresAt)} (7 days after it was sent). If the button no longer works, ask ${inviterName} to re-send it from Team settings.`

  const html = renderEmailShell({
    title: `You're invited to join ${orgName}`,
    bodyHtml,
    ctaLabel: 'Accept invitation',
    ctaUrl: inviteUrl,
    footerNote,
  })

  const text = [
    `You're invited to join ${orgName} on Nova CRM`,
    '',
    `Hi there,`,
    '',
    `${inviterName} has invited you to join ${orgName} on Nova CRM with the ${roleLabel} role.`,
    '',
    `Accept your invitation (expires ${fmtDate(expiresAt)}):`,
    inviteUrl,
    '',
    `If the link no longer works, ask ${inviterName} to re-send it from Team settings.`,
    '',
    '© 2025 Nova CRM',
  ].join('\n')

  return { subject: `You're invited to join ${orgName} on Nova CRM`, html, text }
}

export function welcomeEmail({
  name,
  orgName,
  appUrl,
}: {
  name: string
  orgName: string
  appUrl?: string
}): {
  subject: string
  html: string
  text: string
} {
  const firstName = name.trim().split(/\s+/)[0] || 'there'
  const appLink = appUrl ?? 'http://localhost:3000'
  const bodyHtml = `
                <p style="margin:0 0 16px 0;">Welcome aboard, ${firstName} 👋</p>
                <p style="margin:0 0 16px 0;">
                  Your workspace <strong style="color:#0f172a;">“${orgName}”</strong> is ready — pipeline,
                  contacts, tasks, automation and reports are all set up and waiting for you.
                </p>
                <p style="margin:0 0 8px 0;">Three things to try first:</p>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;">
                  <tr>
                    <td style="padding:4px 10px 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:25px;color:#334155;">
                      <span style="color:#059669;font-weight:bold;">1.</span> Import your contacts from a CSV file
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 10px 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:25px;color:#334155;">
                      <span style="color:#059669;font-weight:bold;">2.</span> Set up a workflow to automate follow-ups
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 10px 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:25px;color:#334155;">
                      <span style="color:#059669;font-weight:bold;">3.</span> Invite your team so deals move faster
                    </td>
                  </tr>
                </table>`
  const footerNote = `You're starting on the Starter plan with a 14-day trial — upgrade any time from Billing.`

  const html = renderEmailShell({
    title: `Welcome to Nova CRM 🎉`,
    bodyHtml,
    ctaLabel: 'Open my workspace',
    ctaUrl: appLink,
    footerNote,
  })

  const text = [
    'Welcome to Nova CRM 🎉',
    '',
    `Welcome aboard, ${firstName}!`,
    '',
    `Your workspace "${orgName}" is ready — pipeline, contacts, tasks, automation and reports are all set up and waiting for you.`,
    '',
    'Three things to try first:',
    '  1. Import your contacts from a CSV file',
    '  2. Set up a workflow to automate follow-ups',
    '  3. Invite your team so deals move faster',
    '',
    `Open your workspace: ${appLink}`,
    '',
    `You're starting on the Starter plan with a 14-day trial — upgrade any time from Billing.`,
    '',
    '© 2025 Nova CRM',
  ].join('\n')

  return { subject: 'Welcome to Nova CRM 🎉', html, text }
}
