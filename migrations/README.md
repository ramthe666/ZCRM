# Nova CRM — Supabase / PostgreSQL Migrations

Production-grade SQL for the multi-tenant Nova CRM database: schema + **Row
Level Security** + a verification suite. The dev sandbox runs SQLite through
Prisma; **these files are what you apply to your Supabase (PostgreSQL 15+)
project for production.**

| File                   | What it does |
| ---------------------- | ------------ |
| `0001_init.sql`        | 23 native enum types, 18 snake_case tables (1:1 with `prisma/schema.prisma`), all `@@index`/`@@unique` indexes, `set_updated_at()` triggers, `users.auth_user_id` bridge to Supabase Auth. Fully idempotent. |
| `0002_rls.sql`         | The centerpiece: RLS **ENABLED + FORCED** on all 18 tables, 146 role-scoped policies (tenant / own / admin / self / app / owner), 5 SECURITY DEFINER helper functions, the `nova_app` strict-mode role, grants & revokes. Idempotent (`DROP POLICY IF EXISTS` before every create). |
| `0003_verification.sql`| Nine checks (CHECK 1–8 + 5b) as DO blocks (RAISE EXCEPTION on failure, RAISE NOTICE on success): RLS flags, enums, helpers, triggers, the **exact policy inventory** (146 policies; 152 once `0004` is applied — verified in either state), no anon policies, reserved write paths, privilege lock-outs. Plus commented attack simulations and the strict-mode walkthrough. |
| `0004_invitations.sql`  | The `invitations` table (email invitations with a 64-hex capability token) + its 6 RLS policies (authenticated read via `is_org_member` or own email via a new `current_user_emails()` helper; nova_app token-credential SELECT + strictly org-pinned writes; owner escape hatch) + grants and its own verification DO block. Run after `0002` (+ `0003`). |
| `0005_demo_seed.sql`    | **Optional** shared demo workspace: 4 demo users + the `nimbusworks` org (professional plan) + the full rich sample dataset (8 accounts, 12 contacts, 10 leads, 12 deals, 12 tasks, 10 activities, 5 products, 3 templates, 3 workflows, 2 campaigns, 4 invoices — all timestamps relative to `now()`), idempotent `ON CONFLICT DO NOTHING` inserts in one transaction + verification DO block. Run last, after `0001`→`0004`; skip it if you don't want a public demo (sign in: demo@novacrm.io / Demo1234!). |

---

## 1. Applying on Supabase

**Option A — Dashboard (recommended, ~2 minutes)**

1. Supabase Dashboard → your project → **SQL Editor**.
2. Open `0001_init.sql`, paste, **Run**. Wait for “Success”.
3. Repeat with `0002_rls.sql`, then `0003_verification.sql` — **in this order**.
4. `0003` prints nine `CHECK n OK …` notices. Any red exception means the
   check that failed (message tells you exactly what and why).

**Option B — Supabase CLI**

```bash
# from the project root
mkdir -p supabase/migrations
cp migrations/0001_init.sql supabase/migrations/00010000000000_init.sql
cp migrations/0002_rls.sql  supabase/migrations/00020000000000_rls.sql
cp migrations/0003_verification.sql supabase/migrations/00030000000000_verification.sql

supabase link --project-ref <your-project-ref>
supabase db push                  # applies in filename order
# (0003 asserts are SELECT-only, so re-running is harmless)
```

**Option C — psql**

```bash
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f migrations/0001_init.sql
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f migrations/0002_rls.sql
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f migrations/0003_verification.sql
```

Notes:

* Run as the `postgres` role (that is what the Dashboard SQL Editor uses).
* All three files are **re-runnable** — safe to apply again.
* `0002`/`0003` require a real Supabase project (they use the `auth` schema,
  `auth.uid()` and the `anon`/`authenticated` roles); `0001` alone also runs
  on a vanilla PostgreSQL 15 server (the `auth.users` FK is skipped there).

### After applying: give the app role a password (once)

```sql
-- never put this in a file / repo:
ALTER ROLE nova_app WITH PASSWORD '<strong-generated-password>';
```

---

## 2. Environment variables for the Next.js app

```bash
# ── Database (Supabase) ────────────────────────────────────────────────────
# Runtime connection: Supabase pooler (Supavisor, transaction mode), port 6543.
# pgbouncer=true + connection_limit=1 are REQUIRED with transaction pooling.
DATABASE_URL="postgresql://nova_app:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Migrations / prisma db pull / one-off scripts: direct connection, port 5432.
DIRECT_URL="postgresql://postgres:<db-password>@db.<project-ref>.supabase.co:5432/postgres"

# ── Optional: Supabase client path (PostgREST) ─────────────────────────────
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"          # public by design
# SUPABASE_SERVICE_ROLE_KEY: server-only, NEVER expose to the browser

# ── Optional integrations (server-side only) ───────────────────────────────
RESEND_API_KEY=""
WHATSAPP_BUSINESS_TOKEN=""
WHATSAPP_PHONE_NUMBER_ID=""
WHATSAPP_VERIFY_TOKEN=""
```

* While developing in the sandbox the app keeps using SQLite
  (`DATABASE_URL="file:./db/custom.db"`). These Supabase values are for the
  production deployment.
* Use the **nova_app** credentials for `DATABASE_URL` in production so RLS
  strict mode applies to every Prisma query. The `postgres` user is for
  `DIRECT_URL` only (dashboard/admin).

---

## 3. Architecture — how tenant isolation works

```
                       ┌───────────────────────────────┐
 browser ──anon key──▶ │ Supabase API (PostgREST)      │── authenticated JWT ─▶ *_tenant_* policies
                       └───────────────────────────────┘        (auth.uid() + memberships)
                       ┌───────────────────────────────┐
 browser ──cookie────▶ │ Next.js API routes             │── Prisma (role nova_app) ─▶ *_app_* policies
                       │  session → user → active org   │     SET LOCAL app.org_id = '<org>'
                       └───────────────────────────────┘
```

Two protected paths, one database:

* **Path A — supabase-js / PostgREST (`authenticated` role):** every request
  carries a user JWT. Policies call `current_user_org_ids()`, which resolves
  active memberships for `auth.uid()`. A user sees exactly the rows of orgs
  where they have an **active** membership — nothing else, enforced by the
  database, not by client code.
* **Path B — Next.js API via Prisma (`nova_app` role):** the API does its own
  session auth (scrypt + httpOnly cookie) and additionally wraps each request
  in a transaction that pins the tenant:

  ```ts
  // src/lib/db.ts pattern
  await prisma.$transaction(async (tx) => {
    // pin the tenant for THIS transaction only (pgbouncer-safe)
    await tx.$executeRawUnsafe(`SELECT set_config('app.org_id', $1, true)`, orgId);
    const leads = await tx.lead.findMany(); // RLS: only this org can come back
    return leads;
  });
  ```

  If the pin is missing, `current_setting('app.org_id', true)` is NULL and
  every `*_app_*` policy fails closed → zero rows. A forgotten `WHERE` clause
  or an SQL injection on this path still cannot cross tenants.

### Role cheat-sheet (as installed by 0002)

| Role           | Can do                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------ |
| `anon`         | Nothing on tables (all privileges revoked; no policies exist for it)                        |
| `authenticated`| Read/write rows of orgs with **active** membership; self profile; own notifications; join orgs only via `invited` membership rows; invoices & audit logs read-only |
| `nova_app`     | Everything the API needs, but org-pinned via `app.org_id` (fail-closed); can write invoices / append audit logs |
| `service_role` | Anything (Supabase platform role, has BYPASSRLS) — org provisioning, billing, support       |
| `postgres`     | Table owner: full access via explicit `*_owner_admin` policies (SQL Editor / ops / dumps)    |

### Documented exceptions (deliberate, commented in 0002)

* `users` / `sessions` have no `org_id` — the API's session layer is their
  gate; `sessions` is fully revoked from `authenticated`.
* `organizations_app_insert` is unpinned (signup must create the org before a
  pin can exist); reads/updates/deletes stay pinned.
* `memberships` app-writes also allow the NULL-pin case (signup bootstrap).
* `invoices` cannot be deleted even by `nova_app` (void instead);
  `audit_logs` is append-only for everyone except the owner/service role.

---

## 4. Scaling to billions of rows

The schema is designed for it:

* **Partitioning (the big lever).** Every tenant table is keyed by `org_id`
  and every hot index leads with `org_id`, so the whole schema is
  partition-ready. When a table outgrows a single node, convert it with a
  pattern like:

  ```sql
  -- example: hash-partition activities by tenant (requires a table rebuild —
  -- do it in a maintenance window; policies and indexes carry over)
  CREATE TABLE public.activities_new (LIKE public.activities INCLUDING ALL)
    PARTITION BY HASH (org_id);
  CREATE TABLE public.activities_p0 PARTITION OF public.activities_new
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
  -- ... p1..p3, then INSERT INTO activities_new SELECT * FROM activities;
  -- swap names in one transaction.
  ```

  With Postgres 15+ you can also use `DEFAULT PARTITION` to add partitions
  online. Start with the append-only, high-volume tables (`activities`,
  `audit_logs`, `notifications`, `invoices`) — they are the ones that grow
  fastest and they are read-mostly.
* **Indexes:** all list/filter columns used by the app
  (`(org_id, status)`, `(org_id, owner_id)`, `(user_id, read)`,
  `(related_type, related_id)`, …) are already covered; the RLS helpers ride
  the `memberships (user_id, org_id)` unique index.
* **Connection pooling:** the pooler + `pgbouncer=true&connection_limit=1`
  in `DATABASE_URL` keeps the serverless API from exhausting connections.
  `SET LOCAL` (not `SET`) keeps strict mode compatible with transaction
  pooling — the tenant pin can never leak between pooled requests.
* **Read replicas:** point analytics/dashboards at a Supabase read replica;
  RLS policies and roles replicate with the schema.
* **Maintenance:** `audit_logs`/`activities` are natural candidates for
  time-based retention (`DELETE ... WHERE created_at < now() - interval '24
  months'` per partition). Monitor with `pg_stat_statements`; watch the
  `pg_policies` count if you add tables (re-run `0003` after any change).

---

## 5. Switching to Supabase Auth later (optional)

The schema is ready for it — no migration needed:

1. Enable email/password (or OAuth) providers in Supabase Auth.
2. Link existing accounts by backfilling the bridge column:

   ```sql
   UPDATE public.users u
   SET auth_user_id = a.id
   FROM auth.users a
   WHERE lower(a.email) = lower(u.email);
   ```

3. That's it — `current_user_row_ids()` matches by `users.auth_user_id`, and
   `users_self_select`/`users_self_update` already use the bridge, so the
   `authenticated` (PostgREST) path starts working for your existing users.
4. When fully switched, the custom `sessions` table can be dropped and the
   login/logout API routes replaced by `supabase.auth.signInWithPassword`.
   (Until then, `sessions` stays server-only.)

---

## 6. Keeping Prisma in sync (important)

* The sandbox schema (`prisma/schema.prisma`) uses SQLite with string enums.
  When you move the app to Supabase, change the datasource:

  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")        // pooler
    directUrl = env("DIRECT_URL")         // migrations/introspection
  }
  ```

* **These SQL files are the source of truth for the production schema.**
  Never run `prisma db push` against production — it would try to rewrite
  native enums back to text and bypass the migration history.
* To reconcile the Prisma models with production, run
  `prisma db pull --url "$DIRECT_URL"` in a scratch copy and let Prisma
  generate native `enum` blocks for the 23 Postgres types, then regenerate
  the client.

## 7. Troubleshooting

| Symptom | Meaning / fix |
| ------- | ------------- |
| `new row violates row-level security policy for table "…"` | Working as intended — the write is outside your allowed org. In the app: check `SET LOCAL app.org_id` is set inside the *same transaction* as the query. |
| App queries return 0 rows via Prisma | `app.org_id` not pinned in this transaction (fail-closed), or the membership is not `active`. |
| SQL Editor sees all rows | Expected: SQL Editor runs as the owner (`*_owner_admin` policies). Test tenant isolation with `SET LOCAL ROLE authenticated` + `request.jwt.claims` (see the attack simulations at the bottom of `0003`). |
| `permission denied for table sessions` as `authenticated` | Intended — sessions are server-side only. |
| Need a new enum value | `ALTER TYPE public.lead_status ADD VALUE 'recycled';` (enums are otherwise immutable), then update `schema.prisma`. |
| Re-running a file fails on `GRANT nova_app TO postgres` | The role already exists and is granted — comment that line out. |

---

*No secrets are stored in these files. Passwords for `nova_app` /
`postgres` live only in your Supabase project settings and deployment
environment.*
