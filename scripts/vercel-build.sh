#!/usr/bin/env bash
# Vercel build command: bash scripts/vercel-build.sh
set -euo pipefail
if [[ "${DATABASE_URL:-}" =~ ^postgres(ql)?:// ]]; then
  echo "► Postgres DATABASE_URL detected — using prisma/schema.postgres.prisma"
  bunx prisma generate --schema prisma/schema.postgres.prisma
else
  echo "► DATABASE_URL is not Postgres — defaulting to the local SQLite schema"
  bunx prisma generate
fi
bunx next build
