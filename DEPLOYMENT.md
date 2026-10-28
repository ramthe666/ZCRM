# Nova CRM — Production Deployment Runbook (Vercel + Supabase + Resend)

Step-by-step, copy-paste-friendly instructions for running Nova CRM in
production. Time budget: **~15 minutes** (plus DNS propagation for email).

---

## Architecture at a glance

| Piece          | Provider | What it does |
| -------------- | -------- | ------------ |
| App            | **Vercel** | Next.js 16 (App Router) — the SPA at `/`, all `/api/*` routes, builds with `scripts/vercel-build.sh` |
| Database       | **Supabase** (PostgreSQL 15+) | Schema + **Row Level Security** from `migrations/0001–0004`, demo data from `migrations/0005` |
| Email          | **Resend** | Transactional email: team invitations, welcome email, campaigns |
| Local sandbox  | SQLite (`prisma/schema.prisma`) | The dev DB (`db/custom.db`) — same Prisma models, no server needed |

Two Prisma schemas ship in the repo, picked automatically at build time:

- `prisma/schema.prisma` — **SQLite**, used locally (`DATABASE_URL=file:…`).
- `prisma/schema.postgres.prisma` — **PostgreSQL**, used by
  `scripts/vercel-build.sh` whenever `DATABASE_URL` starts with `postgres://`.
  Identical models; adds `directUrl` and the `rhel-openssl-3.0.x` engine
  binary Vercel's runtime needs.

**The database schema is defined by the SQL files in [`migrations/`](migrations/README.md),
not by Prisma migrations.** Never run `prisma db push` against production.

### The two protected paths (defense in depth)

1. **API session layer (the path the app uses).** Every `/api/*` route
   authenticates via custom sessions — scrypt password hashes, a
   high-entropy token in an httpOnly cookie, DB-backed `sessions` table —
   and every query is org-scoped (`orgId`) with a role hierarchy
   (member → manager → admin → owner) enforced by `requireAuth()`.
2. **Postgres Row Level Security.** `migrations/0002_rls.sql` enables +
   forces RLS on every table with 146 role-scoped policies; `0003` verifies
   the whole setup. This protects the *direct Supabase API path* (PostgREST /
   `anon` / `authenticated` roles — `anon` has zero privileges) even if
   someone bypasses the Next.js API.

   The Next.js app connects as the **`postgres` table owner** (the
   `*_owner_admin` policies grant it full access — see §2), so RLS is the
   second line of defense while the API session layer is the first. The
   stricter `nova_app` role (queries fail closed unless the transaction pins
   `app.org_id`) is installed and documented in
   [migrations/README.md §3](migrations/README.md) as the hardening path.

---

## 1. Supabase database

1. **Create the project** at [supabase.com](https://supabase.com) →
   **New project**. Pick a region close to your users, choose a strong
   database password (you'll need it below — store it in a password manager).
   Wait for the project to finish provisioning.

2. **Apply the migrations in order** — Dashboard → **SQL Editor** →
   *New query*, paste **one file per Run**, in exactly this order:

   | # | File | What success looks like |
   | - | ---- | ----------------------- |
   | 1 | `migrations/0001_init.sql` | "Success. No rows returned" — creates 23 enums + 18 tables |
   | 2 | `migrations/0002_rls.sql`  | "Success" — RLS on all tables, 146 policies, `nova_app` role |
   | 3 | `migrations/0003_verification.sql` | "Success" + nine `CHECK n OK …` **notices**. Any red exception = stop and fix (it names the failed check) |
   | 4 | `migrations/0004_invitations.sql` | "Success" + `0004 OK — invitations table + RLS verified …` notice |
   | 5 | `migrations/0005_demo_seed.sql` *(optional)* | "Success" + `0005 OK — demo workspace verified …` notice |
   | 6 | `migrations/0006_prisma_compat.sql` | "Success" + four `0006 CHECK A–D OK …` notices |

   `0005` seeds the shared demo workspace (skip it if you don't want a public
   demo — every new signup seeds its own private sample data anyway).
   **`0006` is required** — it converts the 29 enum-typed columns to `text`
   (with identical value domains as CHECK constraints) so the deployed Prisma
   client can write to them. Sign-up/sign-in return 500 until it is applied.

   All six files are **idempotent** — safe to re-run.

3. **Copy the two connection strings**: Dashboard → **Project Settings** →
   **Database** → *Connection string*:

   - **Transaction pooler (port 6543)** → this becomes `DATABASE_URL`.
     It looks like:
     ```
     postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
     ```
     **Append `?pgbouncer=true&connection_limit=1`** to it:
     ```
     postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
     ```
     These two parameters are **required**: Vercel's serverless functions
     must use Supabase's transaction pooler, and with transaction pooling
     each instance may hold at most one connection (prepared statements are
     disabled for Prisma, which is what `pgbouncer=true` configures).
   - **Direct / Session (port 5432)** → this becomes `DIRECT_URL`
     (used by Prisma tooling / one-off scripts):
     ```
     postgresql://postgres.<project-ref>:<password>@db.<project-ref>.supabase.co:5432/postgres
     ```

   > Why the `postgres` user for `DATABASE_URL`? The app's Prisma queries are
   > org-scoped in the API layer and do not (yet) pin `app.org_id` inside
   > each transaction, so the strict `nova_app` RLS role would return zero
   > rows. The `postgres` role owns the tables and every table has an
   > explicit `*_owner_admin` policy for it, so the app works out of the box
   > while `anon`/`authenticated` (the direct Supabase API path) stay fully
   > locked down. Keeping both URLs in your password manager lets you switch
   > to `nova_app` later — see migrations/README.md §2/§3.

---

## 2. Vercel deployment

1. **Push the repo to GitHub** (github.com/ramthe666/ZCRM is already the
   origin — `git push origin main` if anything is unpushed).

2. On [vercel.com](https://vercel.com) → **Add New… → Project** →
   **Import** `ramthe666/ZCRM`. Vercel auto-detects **Next.js** and (from
   `bun.lock`) installs dependencies with Bun.

3. Configure the build:

   - **Framework preset:** Next.js (auto)
   - **Build Command:** `bash scripts/vercel-build.sh` ← **already pinned in the
     repo's `vercel.json`**, so Vercel picks it up automatically on every
     import/deploy. (If your project was imported *before* `vercel.json`
     existed, set it once manually — or delete and re-import — then check the
     build log for the line `► Postgres DATABASE_URL detected`.)
   - **Install Command:** leave default (`bun install`)
   - **Output Directory:** leave default

   `scripts/vercel-build.sh` picks `prisma/schema.postgres.prisma` when
   `DATABASE_URL` is a Postgres URL (and falls back to the SQLite schema
   otherwise, so local builds keep working), generates the Prisma client,
   then runs `next build`. A second safety net,
   `scripts/postinstall.js`, regenerates the client with the correct schema
   right after `bun install` — this is what fixes the "every signup/signin
   returns 500" failure mode where the default SQLite client got generated
   at install time.

4. **Add Environment Variables** (expand *Environment Variables* before
   deploying) — for every Environment (Production + Preview), from
   [`.env.example`](.env.example):

   | Name             | Example value                                                                                          | Required? |
   | ---------------- | ------------------------------------------------------------------------------------------------------ | --------- |
   | `DATABASE_URL`   | `postgresql://postgres.abc123:PASS@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` | **Yes** |
   | `DIRECT_URL`     | `postgresql://postgres.abc123:PASS@db.abc123.supabase.co:5432/postgres`                                 | **Yes** |
   | `APP_URL`        | `https://zcrm11.vercel.app` (your final URL — see below)                                                | Yes* |
   | `RESEND_API_KEY` | `re_…`                                                                                                 | No — without it email runs in demo mode (§3) |
   | `MAIL_FROM`      | `Nova CRM <noreply@yourdomain.com>`                                                                     | No — defaults to `Nova CRM <onboarding@resend.dev>` |

   \* `APP_URL` is used to build invitation accept links and the welcome
   email CTA. You don't know the final `*.vercel.app` URL until the first
   deploy: either guess it (`<project-name>.vercel.app`, predictable from
   the import name), or deploy once, then set `APP_URL` and **redeploy**
   (Deployments → ⋯ → Redeploy). If you use a custom domain, set `APP_URL`
   to that domain and redeploy. No trailing slash.
   **Fallback:** even with `APP_URL` unset, links are built from the request's
   own origin (`x-forwarded-host`), so they always point at the domain the
   invitation was sent from. `APP_URL` just makes them explicit and stable.

5. **Deploy** and wait for the build (≈2–3 min). Then run the
   **first-deploy checklist**:

   - [ ] Open `https://<your-domain>/api/health` — it must say
         `"ok": true` with `"connected": true`. If not, it explains exactly
         what is wrong and how to fix it (database unreachable, wrong
         credentials, missing migrations, Prisma client/schema mismatch…).
   - [ ] Open the deployment URL — the Nova CRM landing page renders.
   - [ ] `/signup` and `/signin` open the auth screens directly and **survive a
         hard refresh** (the address bar keeps the URL; no bounce to `/`).
   - [ ] Sign in with the demo account: `demo@novacrm.io` / `Demo1234!`
         (requires `0005_demo_seed.sql`; otherwise create your own workspace
         via Sign up).
   - [ ] Team → Invite a teammate (your own inbox) — if Resend is configured
         (§3) an invitation email arrives; if not, the UI shows a copy-link
         fallback (that's demo mode, not an error).

**One URL only.** Every Vercel *project* gets its own `<name>.vercel.app`
domain — if you imported the GitHub repo twice you have **two projects** and
therefore two URLs. Keep the one you want (e.g. `zcrm11` →
`https://zcrm11.vercel.app`): open the *other* project → Settings → General →
**Delete Project**. (A project also shows extra auto-generated *deployment*
URLs like `zcrm11-git-main-….vercel.app` / `zcrm11-….vercel.app` — those are
normal aliases of the same deployment, not separate apps; the production
domain is the one linked on the project's Domains page.)

---

## 3. Resend (transactional email)

Without `RESEND_API_KEY` the app never fails — invitations fall back to a
copyable link shown in the UI (`mode: 'demo'`). To send real email:

1. Create an account at [resend.com](https://resend.com) → **API Keys** →
   **Create API Key** (full access) → copy the `re_…` key.
2. **Verify your sending domain**: Resend → **Domains** → *Add domain* →
   enter e.g. `yourdomain.com` → add the displayed **SPF + DKIM DNS records**
   at your registrar → wait for **Verified** (minutes to a few hours).
3. In Vercel → Project → **Settings → Environment Variables**, set:
   - `RESEND_API_KEY` = `re_…`
   - `MAIL_FROM` = `Nova CRM <noreply@yourdomain.com>` (an address on the
     verified domain)
4. Redeploy.

Notes:

- `onboarding@resend.dev` (the default `MAIL_FROM`) **only delivers to the
  email address of the Resend account owner** — it is for testing only.
  Production requires a verified domain.
- Where email is used: **team invitations** (with the accept link
  `APP_URL/?invite=<token>`, 7-day expiry), the **welcome email** on signup,
  and **campaign sends** (campaigns deliver through the same Resend account).

---

## 4. WhatsApp Business API (optional)

WhatsApp credentials are **per-workspace, not env vars** — each organization
connects its own Meta app from inside Nova CRM:

1. [developers.facebook.com](https://developers.facebook.com) → **My Apps →
   Create App** → type *Business* → add the **WhatsApp** product.
2. From the WhatsApp → *API Setup* page, note the **Phone number ID**.
3. Create a **System User** (Business Settings → Users → System users) with
   the admin role, generate a **permanent access token** with the
   `whatsapp_business_messaging` permission (Meta's token tool).
4. In Nova CRM: **Settings → Integrations → WhatsApp Business → Connect**,
   paste:
   - **Phone number ID**
   - **Access token** (the permanent system-user token)
   - **Verify template name** (optional — Meta's `hello_world` test template)
   → *Connect* → use **Test connection** to validate the credentials.
5. Send a test: open any **contact record → WhatsApp button** → send a
   message. With the integration connected it is delivered through the
   WhatsApp Business (Meta Graph) API; without it, the send is recorded in
   demo mode (logged to the timeline only).

---

## 5. The demo workspace

- **What it is** — a shared, public sample workspace (`nimbusworks`,
  professional plan, 4 seats) seeded by `migrations/0005_demo_seed.sql` so
  anyone can explore every module with realistic data: 8 accounts,
  12 contacts, 10 leads, 12 deals across 7 months (so the dashboard and
  report charts look real), tasks, activities, products, 3 automation
  workflows, campaigns, invoices.
- **Sign in** — `demo@novacrm.io` / `Demo1234!` (owner). The other demo
  members — `sarah@` (admin), `marcus@` (manager), `priya@` (member) — use
  the same password, handy for testing role-gated modules.
- **Reset demo data** — owners/admins see a *Reset demo data* button on the
  demo banner in the workspace: it wipes and re-seeds the demo dataset
  (`POST /api/demo/reset`), so the demo always stays usable no matter what
  anyone changes.
- **Reminder** — it is *shared sample data*: anyone can sign in and modify
  it (and reset it). Don't put anything real in it.
- **Don't want it?** Skip `0005_demo_seed.sql` — everything else works
  without it. (To remove it later: delete the `nimbusworks` organization —
  the FK cascades remove all of its data.)

---

## 6. Local development

```bash
bun install

# .env — local SQLite (the sandbox default):
echo 'DATABASE_URL="file:./db/custom.db"' > .env

bun run db:push        # create the SQLite schema
bun prisma/seed.ts     # (optional) create the demo workspace locally
bun run dev            # http://localhost:3000
```

Demo login locally: `demo@novacrm.io` / `Demo1234!`.

Other handy scripts: `bun run db:generate` (regenerate the Prisma client),
`bun run lint`, `bun run build`. Full variable reference: [`.env.example`](.env.example).

---

## 7. Post-deploy verification checklist

- [ ] **Demo sign-in** — `demo@novacrm.io` / `Demo1234!` loads the workspace.
- [ ] **Dashboard** — KPI cards + revenue/pipeline charts render with the demo data.
- [ ] **Create a lead** with source *Ads* → the "Ad lead → 24h follow-up"
      workflow fires (a task + a notification appear) — automation works.
- [ ] **Invitation flow** — Team → invite a real email address → the email
      arrives (Resend) → the accept link opens the invite banner → signup
      with that email joins the workspace.
- [ ] **Campaign send** — Campaigns → send the draft campaign (works in demo
      mode; delivers for real once Resend is configured).
- [ ] **Role enforcement** — sign in as `priya@novacrm.io` (member):
      Campaigns/Workflows/Integrations/Billing are hidden in the sidebar
      and ⌘K palette, and the Billing API returns 403.
- [ ] **Org switcher** — a user with two workspaces can switch between them
      (create a second workspace via signup, then accept an invite).
- [ ] **Demo password** — all four `*@novacrm.io` demo accounts sign in with
      `Demo1234!`.
- [ ] **Reset demo** — the Reset demo data button restores the pristine
      dataset (owner/admin only).
- [ ] **Audit log** — Settings → Audit log records sign-ins, creates,
      updates, invitations, sends.

---

## 8. Troubleshooting

> **Start at `https://<your-domain>/api/health`** — it classifies the failure
> (wrong credentials, unreachable host, missing tables, Prisma
> client/provider mismatch, pooler misconfiguration) and prints the fix.
> API errors surfaced in the UI now carry the same actionable hint.

| Symptom | Cause / fix |
| ------- | ----------- |
| **Every signup/signin returns 500** ("Something went wrong…") with static pages fine | The deployed Prisma client was generated from the **SQLite** schema at install time instead of the Postgres one. Fixed in-repo: `vercel.json` pins the build command and `scripts/postinstall.js` regenerates the client with the right schema after install. Pull the latest commit and **redeploy** — verify the build log shows `► Postgres DATABASE_URL detected` and `/api/health` says `"ok": true`. |
| **401 "Not signed in" right after signing in** | Cookie/URL mismatch: the session cookie is `httpOnly` + `Secure` + `SameSite=None` on HTTPS. Make sure you're on the exact `APP_URL` origin (no `www` vs bare-domain mix), and that `APP_URL` matches the URL you're browsing (https, no trailing slash). Local `http://localhost:3000` works with `SameSite=Lax` automatically. |
| **Prisma engine error on Vercel** (`Query engine library not found` / `ssl` load failures) | The Vercel runtime needs the `rhel-openssl-3.0.x` engine binary — already handled by `prisma/schema.postgres.prisma` (`binaryTargets`). Make sure the build used `bash scripts/vercel-build.sh` and the Postgres schema (check the build log line "► Postgres DATABASE_URL detected"). |
| **`prepared statement … does not exist`** | `DATABASE_URL` (pooler, port 6543) is missing `?pgbouncer=true`. The app now appends it automatically at runtime (`src/lib/db.ts`), but keep it in the env var: `…postgres?pgbouncer=true&connection_limit=1`. |
| **Connection timeouts / "too many connections"** | `DATABASE_URL` must be the **pooler on port 6543** with `?pgbouncer=true&connection_limit=1`. Port 5432 direct connections from serverless functions will exhaust Supabase's connection limit — `5432` is for `DIRECT_URL` tooling only. |
| **RLS errors / empty lists** (`new row violates row-level security policy`, or every query returns 0 rows) | Migrations out of order — apply `0001 → 0002 → 0003 → 0004 → 0006` in order (0003 must pass silently). If you deliberately connect as `nova_app` (strict mode), every transaction must `SET LOCAL app.org_id` — the current app does not do this yet, so use the `postgres` credentials as documented in §1. |
| **Resend 403 / emails not arriving** | Sending domain not verified in Resend (add SPF/DKIM records), or `MAIL_FROM` isn't on the verified domain. `onboarding@resend.dev` only delivers to the Resend account owner. |
| **Demo sign-in 404 / "no workspace"** | `0005_demo_seed.sql` wasn't applied — run it in the Supabase SQL Editor (after 0001–0004), then sign in again. |
| **Sign-up/sign-in 500 — "columns are still native enum types"** | `0006_prisma_compat.sql` wasn't applied — run it (after 0001 → 0005), then retry. |
| **Sign-up/sign-in 500 — "Database tables are missing"** | Migrations not (all) applied, or `DATABASE_URL` points at a different Supabase project than the one you migrated. Apply `0001` → `0006` in order to the project `DATABASE_URL` points at — see `/api/health` to confirm the host. |
| **Invite links point at localhost** | `APP_URL` is unset or stale in Vercel — set it to the production URL and redeploy. (Links built during serverless invocations fall back to the request's own origin, so this only happens for links generated where no origin header exists.) |
| **`prisma db push` accidentally run against prod** | Don't — the SQL files in `migrations/` are the source of truth for production; `db push` would try to alter types/constraints and bypass the migration history. |

---

*No secrets belong in this repo — everything above uses placeholders. Real
values live in Supabase/Vercel/Resend dashboards and your password manager.*
