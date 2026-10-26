# Nova CRM

**A calm, fast, multi-tenant CRM for revenue teams.** Nova CRM packs the whole
customer lifecycle into one emerald-and-slate workspace: capture leads, convert
them into accounts, contacts and deals, move deals across a kanban pipeline,
automate the follow-up with no-code workflows, run email campaigns, and read
it all back through live dashboards and reports — with row-level-security
grade tenant isolation, a strict role hierarchy, and a public demo workspace
you can reset with one click.

> 🔐 **Try it instantly** — demo workspace `NimbusWorks`:
> **`demo@novacrm.io`** / **`Demo1234!`** (professional plan, 4 seats,
> realistic sample data across every module). It's a shared demo — the owner
> can restore the pristine dataset anytime with **Reset demo data**.

---

## Features (18 modules)

| | | |
| --- | --- | --- |
| 🧲 **Leads** — capture, qualify, one-click convert (account + contact + deal) | 👥 **Contacts** — lifecycle stages, account links, WhatsApp messaging | 🏢 **Accounts** — tiers, industry, revenue, territory |
| 📊 **Deals** — drag-and-drop kanban (6 stages) + table view | ✅ **Tasks** — priorities, due dates, assignees | 📅 **Calendar** — month grid with task agendas |
| 📝 **Activities** — calls, meetings, notes, emails, WhatsApp timeline | 📣 **Campaigns** — segments, templates, send + open/click stats | ⚙️ **Workflows** — visual automation builder (triggers → conditions → actions) |
| 📈 **Reports** — 6 charts + CSV export | 👥 **Team & roles** — owner / admin / manager / member with enforced permissions | ✉️ **Invitations** — email invitations (Resend) with accept links, resend & revoke |
| 💳 **Billing** — plans, seat/usage limits, mock checkout, invoices | 🔌 **Integrations** — 12 providers incl. **WhatsApp Business API** (real sends via Meta Graph) | ⬆️⬇️ **Import / Export** — CSV import with per-row validation + CSV export |
| 🔍 **Global search (⌘K)** — debounced cross-module search + quick nav | 🧪 **Demo workspace** — shared sample org, one-click reset | 🌓 **Dark mode**, responsive layout, framer-motion polish |

Plus: a custom landing page, scrypt password auth with DB-backed sessions,
multi-workspace org switcher, notifications, an append-only audit log, and
rate limiting on sensitive endpoints.

## Tech stack

| Layer      | Tech |
| ---------- | ---- |
| Framework  | Next.js 16 (App Router), React 19, TypeScript |
| UI         | Tailwind CSS 4, shadcn/ui, Radix primitives, lucide icons, framer-motion, recharts, dnd-kit |
| State      | Zustand |
| Database   | Prisma ORM — **SQLite** in the dev sandbox, **PostgreSQL (Supabase)** in production |
| Security   | Custom cookie sessions (scrypt), org-scoped queries, Postgres **Row Level Security** (146+ policies) |
| Email      | Resend (transactional + campaigns) with a graceful demo-mode fallback |
| Deploy     | Vercel (app) + Supabase (database) — one-click via `scripts/vercel-build.sh` |

## Quick start (local)

```bash
bun install
echo 'DATABASE_URL="file:./db/custom.db"' > .env
bun run db:push        # create the SQLite schema
bun prisma/seed.ts     # optional: seed the demo workspace
bun run dev            # → http://localhost:3000
```

Sign in with `demo@novacrm.io` / `Demo1234!` — or create your own workspace
(it gets seeded with starter data automatically).

## Production deploy

Vercel + Supabase + Resend, in ~15 minutes:
**see [`DEPLOYMENT.md`](DEPLOYMENT.md)** — Supabase migrations (schema, RLS,
verification, invitations, demo seed), Vercel project import with the custom
build command, environment variables, Resend domain verification, optional
WhatsApp Business setup, and a post-deploy checklist.

## Project structure

```
├── src/
│   ├── app/                  # App Router: / (SPA) + /api/* routes (24 endpoints)
│   │   ├── api/              # auth, data CRUD, invitations, campaigns, billing, …
│   │   └── page.tsx          # SPA boot: landing | auth | workspace
│   ├── components/
│   │   └── crm/              # Workspace shell, AuthView, views/ (18 modules), landing/
│   └── lib/                  # auth, db, entities registry, workflows, mailer, seed, crm
├── prisma/
│   ├── schema.prisma         # SQLite (dev sandbox) — 19 models
│   ├── schema.postgres.prisma# PostgreSQL (production, picked by the Vercel build)
│   └── seed.ts               # demo workspace seeder
├── migrations/               # Supabase/Postgres SQL: schema, RLS, verification, invitations, demo seed
├── scripts/
│   └── vercel-build.sh       # Vercel build command (schema autodetection)
├── DEPLOYMENT.md             # production runbook
└── .env.example              # every environment variable, documented
```

## Screenshots

📸 *Screenshots coming soon — run the demo workspace locally (`bun run dev`)
or visit the deployed demo to see the dashboard, deal kanban, workflow builder
and ⌘K global search in action.*

---

**License:** Proprietary — © 2025. All rights reserved.
