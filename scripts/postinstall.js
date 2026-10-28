#!/usr/bin/env node
/* eslint-disable */
// =============================================================================
// Nova CRM — smart Prisma client generation (postinstall)
// =============================================================================
// WHY THIS EXISTS
//   The repo ships TWO Prisma schemas:
//     prisma/schema.prisma          — SQLite   (local sandbox/dev)
//     prisma/schema.postgres.prisma — Postgres (Vercel + Supabase production)
//
//   Dependency install runs BEFORE the build command and @prisma/client's own
//   postinstall would generate the client from the DEFAULT schema (SQLite).
//   If that client is deployed with a postgres:// DATABASE_URL, EVERY query
//   fails at runtime with:
//     "the URL must start with the protocol file://"
//   → opaque 500s on signup/signin.
//
//   This script runs after install, looks at DATABASE_URL and regenerates the
//   client from the CORRECT schema:
//     postgres:// | postgresql:// → prisma/schema.postgres.prisma
//     anything else (file:, empty) → prisma/schema.prisma (SQLite)
//
//   It is deliberately defensive: a failure here logs a warning and exits 0 so
//   a missing optional dev tool can never break `install` (the build command
//   scripts/vercel-build.sh regenerates the client again anyway).
// =============================================================================

const { execSync } = require('child_process')

function main() {
  const url = (process.env.DATABASE_URL || '').trim()
  const isPostgres = /^postgres(ql)?:\/\//i.test(url)
  const schema = isPostgres ? 'prisma/schema.postgres.prisma' : 'prisma/schema.prisma'

  console.log(
    isPostgres
      ? '  postinstall: DATABASE_URL is Postgres → generating client from prisma/schema.postgres.prisma'
      : '  postinstall: DATABASE_URL is not Postgres (SQLite/local) → generating client from prisma/schema.prisma'
  )

  // Prefer the package manager that is driving this install; both work.
  const runner = process.versions.bun ? 'bunx' : 'npx'
  execSync(`${runner} prisma generate --schema ${schema}`, { stdio: 'inherit' })
}

try {
  main()
} catch (e) {
  console.warn('  postinstall: prisma generate skipped (' + (e && e.message ? e.message : e) + ')')
  console.warn('  postinstall: the build command will retry generation.')
}
