#!/usr/bin/env bash
# =============================================================================
# Nova CRM — Vercel build command (referenced by vercel.json)
# =============================================================================
# Generates the Prisma client from the schema that matches DATABASE_URL, then
# builds Next.js. scripts/postinstall.js already does the same selection at
# install time — this is the second, authoritative pass at build time.
# =============================================================================
set -euo pipefail

# Prefer bunx (the repo locks with bun.lock); fall back to npx.
if command -v bunx >/dev/null 2>&1; then
  PRISMA="bunx prisma"
  NEXT="bunx next"
else
  PRISMA="npx prisma"
  NEXT="npx next"
fi

if [[ "${DATABASE_URL:-}" =~ ^postgres(ql)?:// ]]; then
  echo "► Postgres DATABASE_URL detected — generating client from prisma/schema.postgres.prisma"
  $PRISMA generate --schema prisma/schema.postgres.prisma
else
  echo "► DATABASE_URL is not Postgres — generating client from the local SQLite schema"
  $PRISMA generate
fi

echo "► Building Next.js"
$NEXT build
