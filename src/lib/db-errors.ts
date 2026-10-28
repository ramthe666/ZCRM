// ── Database error classification ───────────────────────────────────────────
// Turns raw Prisma/Postgres errors into actionable, user-readable diagnoses.
// Used by errorResponse() (src/lib/auth.ts) and /api/health so a production
// failure says WHAT broke and HOW to fix it instead of an opaque 500.

export interface DbIssue {
  /** Short, human-readable cause (safe to show in the UI). */
  headline: string
  /** The fix — what the operator should do. */
  hint: string
  /** Stable machine code for programmatic handling. */
  code:
    | 'client_sqlite_vs_postgres'
    | 'pgbouncer_prepared_statements'
    | 'table_missing'
    | 'column_missing'
    | 'enum_text_mismatch'
    | 'unreachable'
    | 'auth_failed'
    | 'rls_violation'
    | 'connection_closed'
    | 'unknown'
}

function textOf(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`
  if (typeof e === 'string') return e
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

/**
 * Classify a caught error as a known database/Prisma issue, or null when the
 * error is not recognisable as a DB problem.
 */
export function classifyDbError(e: unknown): DbIssue | null {
  const raw = textOf(e)
  const m = raw.toLowerCase()

  // The deployed Prisma client was generated from the SQLite schema while
  // DATABASE_URL points at Postgres (the classic "generated at install time
  // from the default schema" failure on Vercel).
  if (
    m.includes('must start with the protocol') ||
    (m.includes('file://') && (m.includes('datasource') || m.includes('url'))) ||
    (m.includes('sqlite') && m.includes('postgres'))
  ) {
    return {
      code: 'client_sqlite_vs_postgres',
      headline: 'Server database misconfiguration: the app was built with the SQLite Prisma client but DATABASE_URL points at Postgres.',
      hint: 'Redeploy with this repo’s build command (bash scripts/vercel-build.sh — now pinned in vercel.json) so the Postgres client is generated. Verify at /api/health.',
    }
  }

  // Supabase transaction pooler (pgbouncer, port 6543) rejects Prisma's
  // prepared statements unless ?pgbouncer=true is on the URL.
  if (m.includes('prepared statement') || m.includes('pgbouncer')) {
    return {
      code: 'pgbouncer_prepared_statements',
      headline: 'The database pooler rejected a prepared statement.',
      hint: 'DATABASE_URL (port 6543) needs ?pgbouncer=true — the app now appends it automatically at runtime. Redeploy the latest commit.',
    }
  }

  // Migrations not applied (or applied to a different database).
  if (m.includes('p2021') || (m.includes('table') && m.includes('does not exist'))) {
    return {
      code: 'table_missing',
      headline: 'Database tables are missing.',
      hint: 'Apply the SQL migrations in order (0001 → 0006) to the Supabase project DATABASE_URL points at — see migrations/README.md.',
    }
  }

  // Deployed before 0006 was applied: the Prisma client sends text-typed
  // parameters but the columns are still native enums (SQLSTATE 42804).
  if (
    m.includes('but expression is of type text') ||
    m.includes('datatype mismatch') ||
    (m.includes('is of type') && m.includes('but expression is of type'))
  ) {
    return {
      code: 'enum_text_mismatch',
      headline: 'The database columns are still native enum types.',
      hint: 'Apply migrations/0006_prisma_compat.sql (run AFTER 0001 → 0005) — it converts the enum columns to text so the app can write to them. Then retry.',
    }
  }

  // Schema drift between migrations and the Prisma schema.
  if (m.includes('p2022') || (m.includes('column') && m.includes('does not exist'))) {
    return {
      code: 'column_missing',
      headline: 'A database column the app expects is missing.',
      hint: 'Your applied migrations are out of sync with the deployed code — re-apply the latest migrations/ SQL files, then redeploy.',
    }
  }

  // Wrong host / network / pooler region.
  if (m.includes('p1001') || m.includes("can't reach database server") || m.includes('econnrefused') || m.includes('enotfound')) {
    return {
      code: 'unreachable',
      headline: 'The database server cannot be reached.',
      hint: 'Check DATABASE_URL — it must be the Supabase transaction pooler host (…pooler.supabase.com, port 6543) from Project → Connect.',
    }
  }

  // Wrong credentials.
  if (m.includes('p1000') || m.includes('authentication failed') || m.includes('password authentication')) {
    return {
      code: 'auth_failed',
      headline: 'The database rejected the credentials.',
      hint: 'Reset the database password in Supabase (Settings → Database) and update DATABASE_URL on Vercel with the new password.',
    }
  }

  // RLS blocked a write (only possible when connecting as a non-owner role).
  if (m.includes('row-level security') || m.includes('violates row-level') || m.includes('rls')) {
    return {
      code: 'rls_violation',
      headline: 'A row-level security policy blocked this database write.',
      hint: 'DATABASE_URL must connect as the postgres (table owner) role — the *_owner_admin policies in migrations/0002_rls.sql grant the app full access. See DEPLOYMENT.md §2.',
    }
  }

  // Flaky pooler / idle timeout.
  if (m.includes('p1017') || m.includes('server closed the connection')) {
    return {
      code: 'connection_closed',
      headline: 'The database connection was closed mid-request.',
      hint: 'This is usually transient (pooler idle timeout) — retry. If it persists, redeploy so the runtime reopens fresh connections.',
    }
  }

  // Prisma error codes that are clearly DB-related but need no special copy.
  if (m.includes('prismaclient') || m.includes('prisma client') || m.includes('query engine')) {
    return {
      code: 'unknown',
      headline: 'A database client error occurred.',
      hint: 'Visit /api/health for a full diagnosis, and check the deployment logs.',
    }
  }

  return null
}
