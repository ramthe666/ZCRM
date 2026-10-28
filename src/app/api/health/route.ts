import { db, describeDatabaseUrl } from '@/lib/db'
import { classifyDbError } from '@/lib/db-errors'
import { json } from '@/lib/auth'
import { appBaseUrl } from '@/lib/mailer'

// ── Deployment diagnostics ──────────────────────────────────────────────────
// GET /api/health — a safe, secret-free self-check the operator can open in
// the browser to see exactly WHY the app cannot reach the database (or that
// everything is fine). Never exposes credentials; only protocols, hosts and
// classified error causes.

export const dynamic = 'force-dynamic'

function maskAbsent(v: string | undefined): boolean {
  return Boolean(v && v.trim().length > 0)
}

export async function GET(req: Request) {
  const url = describeDatabaseUrl()

  let connected = false
  let serverVersion: string | null = null
  let issue: ReturnType<typeof classifyDbError> = null
  let rawErrorName: string | null = null

  try {
    // Provider-agnostic liveness check (works on Postgres and SQLite).
    await db.$queryRaw`SELECT 1`
    connected = true
  } catch (e) {
    issue = classifyDbError(e)
    rawErrorName = e instanceof Error ? e.constructor.name : typeof e
    console.error('[health] database check failed:', e)
  }

  if (connected) {
    // Best-effort version string — never flips `connected` back to false.
    // Pick the provider-appropriate query first so the Prisma error logger
    // stays quiet (url.protocol comes from describeDatabaseUrl).
    const attempts: string[][] =
      url.protocol === 'file'
        ? [['sqlite'], ['postgres']]
        : [['postgres'], ['sqlite']]
    for (const [dialect] of attempts) {
      try {
        if (dialect === 'postgres') {
          const rows = (await db.$queryRaw`SELECT version() AS v`) as { v: string }[]
          serverVersion = rows[0]?.v?.split(' ').slice(0, 2).join(' ') ?? null
        } else {
          const rows = (await db.$queryRaw`SELECT sqlite_version() AS v`) as { v: string }[]
          serverVersion = rows[0]?.v ? `SQLite ${rows[0].v}` : null
        }
        if (serverVersion) break
      } catch {
        // try the next dialect
      }
    }
  }

  const env = {
    NODE_ENV: process.env.NODE_ENV ?? 'unknown',
    APP_URL: maskAbsent(process.env.APP_URL),
    RESEND_API_KEY: maskAbsent(process.env.RESEND_API_KEY),
    MAIL_FROM: maskAbsent(process.env.MAIL_FROM),
  }

  const warnings: string[] = []
  if (url.protocol === 'postgres' && !url.pooler) {
    warnings.push(
      'DATABASE_URL is not the transaction pooler (port 6543) — serverless functions can exhaust Supabase connections. Use the pooler URI from Supabase → Connect.'
    )
  }
  if (url.protocol === 'postgres' && url.pooler && !url.pgbouncerParam) {
    warnings.push('pgbouncer=true is missing (the app patches it in memory, but updating the env var is cleaner).')
  }
  if (env.NODE_ENV === 'production' && !env.RESEND_API_KEY) {
    warnings.push('RESEND_API_KEY is not set — invitation emails fall back to copy-link demo mode.')
  }
  if (url.protocol === 'missing') {
    warnings.push('DATABASE_URL is not set at all — every database call will fail.')
  }

  return json({
    ok: connected,
    resolvedBaseUrl: appBaseUrl(req),
    env,
    database: {
      connected,
      serverVersion,
      url,
      issue,
      ...(rawErrorName && !issue ? { rawErrorName } : {}),
    },
    warnings,
    hint: connected
      ? null
      : 'Fix the issues above, then redeploy. If everything looks right here but a specific page fails, check the Vercel function logs for that request.',
  })
}
