import { PrismaClient } from '@prisma/client'

// ── Runtime DATABASE_URL hardening ──────────────────────────────────────────
// Supabase's transaction pooler (port 6543) requires extra query params that
// are easy to forget when pasting the connection string:
//   * pgbouncer=true        — disables Prisma prepared statements (PgBouncer
//                             in transaction mode can't track them →
//                             "prepared statement does not exist" errors)
//   * connection_limit=1    — one DB connection per serverless instance; more
//                             would exhaust Supabase's connection cap
//   * sslmode=require       — Supabase requires TLS; pin it explicitly
// The app fixes the URL at runtime so a missing param can never take signup
// or sign-in down, no matter how the env var was pasted.

function normalizeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    // e.g. "file:./db/custom.db" or other non-standard form — pass through.
    return raw
  }

  const isPostgres = url.protocol === 'postgres:' || url.protocol === 'postgresql:'
  if (!isPostgres) return raw

  const isSupabase =
    url.hostname.endsWith('.pooler.supabase.com') ||
    url.hostname.endsWith('.supabase.com') ||
    url.hostname.endsWith('.supabase.co')

  // Transaction pooler — port 6543.
  if (url.port === '6543') {
    if (url.searchParams.get('pgbouncer') !== 'true') url.searchParams.set('pgbouncer', 'true')
    if (!url.searchParams.get('connection_limit')) url.searchParams.set('connection_limit', '1')
  }

  if (isSupabase && !url.searchParams.get('sslmode')) url.searchParams.set('sslmode', 'require')

  return url.toString()
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const url = normalizeDatabaseUrl(process.env.DATABASE_URL)

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Keep runtime logs readable: only warnings/errors. Query tracing made
    // dev.log unusable and can leak record data into logs in production.
    log: ['warn', 'error'],
    // Hardened URL (same value as DATABASE_URL when nothing needed fixing).
    ...(url ? { datasources: { db: { url } } } : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/** For /api/health — the effective URL, with the password masked. */
export function describeDatabaseUrl(): {
  protocol: string
  host: string
  port: string
  pooler: boolean
  pgbouncerParam: boolean
  connectionLimitParam: boolean
} {
  const effective = url ?? process.env.DATABASE_URL ?? ''
  if (effective.startsWith('file:')) {
    return {
      protocol: 'file',
      host: 'local sqlite file',
      port: '—',
      pooler: false,
      pgbouncerParam: false,
      connectionLimitParam: false,
    }
  }
  try {
    const u = new URL(effective)
    return {
      protocol: u.protocol.replace(':', ''),
      host: u.hostname,
      port: u.port || 'default',
      pooler: u.port === '6543',
      pgbouncerParam: u.searchParams.get('pgbouncer') === 'true',
      connectionLimitParam: Boolean(u.searchParams.get('connection_limit')),
    }
  } catch {
    return {
      protocol: effective ? 'unparsed' : 'missing',
      host: '—',
      port: '—',
      pooler: false,
      pgbouncerParam: false,
      connectionLimitParam: false,
    }
  }
}
