-- =============================================================================
-- Nova CRM — 0001_init.sql
-- Schema bootstrap for PostgreSQL 15+ / Supabase.
--
-- Mirrors prisma/schema.prisma (18 models) 1:1:
--   * Native ENUM types for every status / enum-like field.
--   * snake_case tables & columns. Primary keys are `text` — the Next.js app
--     generates cuids; gen_random_uuid()::text is only a fallback default
--     for raw SQL inserts / backfills.
--   * Every foreign key uses the exact ON DELETE behaviour of the Prisma
--     schema (org children CASCADE, owner/user references SET NULL,
--     session & membership user references CASCADE).
--   * Every @@index / @@unique from the Prisma schema is present.
--   * `updated_at` is maintained by the public.set_updated_at() trigger.
--   * Money/amount columns are `double precision` (Prisma Float).
--   * Timestamps are `timestamptz` (Prisma DateTime maps transparently and
--     Supabase recommends timestamptz over `timestamp`).
--
-- Idempotency: safe to re-run.
--   * CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
--   * CREATE TYPE wrapped in DO blocks with duplicate_object handlers
--   * CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS + CREATE TRIGGER
--   * the auth.users foreign key is added conditionally (Supabase only)
--
-- Apply (as the `postgres` role):
--   Supabase Dashboard -> SQL Editor -> paste & Run
--   or:  psql "$DIRECT_URL" -f migrations/0001_init.sql
--
-- NOTE: this file only creates the schema. Row Level Security lives in
-- 0002_rls.sql. Run files in order: 0001 -> 0002 -> 0003.
-- =============================================================================

-- pgcrypto provides gen_random_uuid() for PG < 13; on PG 13+ it is built in.
-- On Supabase the extension is pre-installed, so this is a no-op.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. ENUM TYPES
-- -----------------------------------------------------------------------------
-- One native Postgres enum per status/enum-like field of the Prisma schema.
-- Each block is guarded so the file can be re-run (duplicate_object is
-- swallowed). Enum values are IMMUTABLE once created — to extend a list run
-- e.g.:  ALTER TYPE public.lead_status ADD VALUE 'recycled';
-- (and update prisma/schema.prisma to match).
-- =============================================================================

-- memberships.role  (owner | admin | manager | member)
DO $$
BEGIN
  CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'manager', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL; -- already created on a previous run
END $$;

-- memberships.status  (active | invited)
DO $$
BEGIN
  CREATE TYPE public.membership_status AS ENUM ('active', 'invited');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- leads.status  (new | contacted | qualified | unqualified | converted)
DO $$
BEGIN
  CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'unqualified', 'converted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- leads.source / contacts.source / deals.source
-- (website | referral | ads | event | cold_call | social | partner)
DO $$
BEGIN
  CREATE TYPE public.lead_source AS ENUM ('website', 'referral', 'ads', 'event', 'cold_call', 'social', 'partner');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- deals.stage (qualification | needs_analysis | value_prop | negotiation |
--              closed_won | closed_lost)
DO $$
BEGIN
  CREATE TYPE public.deal_stage AS ENUM ('qualification', 'needs_analysis', 'value_prop', 'negotiation', 'closed_won', 'closed_lost');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- tasks.status  (not_started | in_progress | completed | deferred)
DO $$
BEGIN
  CREATE TYPE public.task_status AS ENUM ('not_started', 'in_progress', 'completed', 'deferred');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- tasks.priority  (low | normal | high | urgent)
DO $$
BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- activities.type  (note | call | meeting | email | whatsapp | task)
DO $$
BEGIN
  CREATE TYPE public.activity_type AS ENUM ('note', 'call', 'meeting', 'email', 'whatsapp', 'task');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- activities.outcome (connected | no_answer | left_voicemail | scheduled |
--                     interested | not_interested)
DO $$
BEGIN
  CREATE TYPE public.activity_outcome AS ENUM ('connected', 'no_answer', 'left_voicemail', 'scheduled', 'interested', 'not_interested');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- contacts.lifecycle (lead | marketing_qualified | sales_qualified |
--                     customer | evangelist)
DO $$
BEGIN
  CREATE TYPE public.lifecycle_stage AS ENUM ('lead', 'marketing_qualified', 'sales_qualified', 'customer', 'evangelist');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- accounts.tier  (standard | silver | gold | platinum)
DO $$
BEGIN
  CREATE TYPE public.account_tier AS ENUM ('standard', 'silver', 'gold', 'platinum');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- accounts.size  ('1-10' | '11-50' | '51-200' | '201-1000' | '1000+')
DO $$
BEGIN
  CREATE TYPE public.account_size AS ENUM ('1-10', '11-50', '51-200', '201-1000', '1000+');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- tasks.related_type / activities.related_type  (lead | contact | account | deal)
DO $$
BEGIN
  CREATE TYPE public.related_entity_type AS ENUM ('lead', 'contact', 'account', 'deal');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- campaigns.status  (draft | sending | sent)
DO $$
BEGIN
  CREATE TYPE public.campaign_status AS ENUM ('draft', 'sending', 'sent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- campaigns.segment  (all | customers | prospects | newsletter)
DO $$
BEGIN
  CREATE TYPE public.campaign_segment AS ENUM ('all', 'customers', 'prospects', 'newsletter');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- notifications.type  (info | success | warning | deal | task | team | billing)
DO $$
BEGIN
  CREATE TYPE public.notification_type AS ENUM ('info', 'success', 'warning', 'deal', 'task', 'team', 'billing');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- integrations.status  (connected | error | disabled)
-- (integrations.provider stays plain text: it is an open catalog that grows
--  over time — constraining it to an enum would require a migration for
--  every new provider.)
DO $$
BEGIN
  CREATE TYPE public.integration_provider_status AS ENUM ('connected', 'error', 'disabled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- invoices.status  (paid | open | void)
DO $$
BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('paid', 'open', 'void');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- products.billing_cycle / invoices.cycle / organizations.billing_cycle
-- (one_time | monthly | yearly). NOTE: a single superset enum is used —
-- organizations only use 'monthly'/'yearly', products also use 'one_time'.
DO $$
BEGIN
  CREATE TYPE public.billing_cycle AS ENUM ('one_time', 'monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- organizations.plan / invoices.plan  (starter | standard | professional | enterprise)
DO $$
BEGIN
  CREATE TYPE public.plan_key AS ENUM ('starter', 'standard', 'professional', 'enterprise');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- organizations.plan_status  (trialing | active | past_due | canceled)
DO $$
BEGIN
  CREATE TYPE public.plan_status AS ENUM ('trialing', 'active', 'past_due', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- workflows.trigger  (lead.created | lead.status_changed | deal.created |
--                     deal.stage_changed | contact.created | task.created)
DO $$
BEGIN
  CREATE TYPE public.workflow_trigger AS ENUM ('lead.created', 'lead.status_changed', 'deal.created', 'deal.stage_changed', 'contact.created', 'task.created');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- email_templates.category  (general | sales | onboarding | support | marketing)
DO $$
BEGIN
  CREATE TYPE public.email_template_category AS ENUM ('general', 'sales', 'onboarding', 'support', 'marketing');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. TABLES
-- -----------------------------------------------------------------------------
-- Created in dependency order (organizations before their children;
-- accounts before contacts/deals) so every foreign key can be declared
-- inline with its exact ON DELETE behaviour.
-- =============================================================================

-- ── Identity ─────────────────────────────────────────────────────────────────

-- Prisma model: User
CREATE TABLE IF NOT EXISTS public.users (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text, -- app generates cuids; uuid fallback for raw SQL
  email         text NOT NULL,                       -- case-insensitive uniqueness enforced below (users_email_lower_key)
  name          text NOT NULL,
  password_hash text NOT NULL,                       -- scrypt hash managed by the Next.js API
  title         text,
  phone         text,
  avatar_color  text NOT NULL DEFAULT '#059669',
  -- Link to Supabase Auth (optional, for teams that switch auth providers):
  -- when migrating to Supabase Auth, backfill this column with auth.users.id.
  -- The FK to auth.users(id) ON DELETE SET NULL is added at the bottom of this
  -- file, but only when the auth schema exists (i.e. on Supabase).
  auth_user_id  uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_key UNIQUE (email)          -- satisfies Prisma @unique
);

-- Prisma model: Session (custom auth — httpOnly cookie token; service-role
-- and the trusted app role only, never exposed to anon/authenticated reads)
CREATE TABLE IF NOT EXISTS public.sessions (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token      text NOT NULL,                          -- high-entropy session token
  user_id    text NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  user_agent text,
  CONSTRAINT sessions_token_key UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions (user_id);

-- Prisma model: Organization (the tenant root — every tenant table points here)
CREATE TABLE IF NOT EXISTS public.organizations (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          text NOT NULL,
  slug          text NOT NULL,
  plan          public.plan_key       NOT NULL DEFAULT 'starter',
  billing_cycle public.billing_cycle  NOT NULL DEFAULT 'monthly',
  plan_status   public.plan_status    NOT NULL DEFAULT 'trialing',
  trial_ends_at timestamptz,
  billing_email text,
  currency      text NOT NULL DEFAULT 'USD',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_key UNIQUE (slug)    -- also serves @@index([slug]) — a unique constraint is backed by an index
);

-- Prisma model: Membership (user <-> org with role & status)
CREATE TABLE IF NOT EXISTS public.memberships (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    text NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  org_id     text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  role       public.member_role       NOT NULL DEFAULT 'member',
  status     public.membership_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_user_id_org_id_key UNIQUE (user_id, org_id)
);

-- Also used by the RLS helpers (user_id lookups via the leftmost prefix).
CREATE INDEX IF NOT EXISTS memberships_org_id_idx ON public.memberships (org_id);

-- ── Core CRM ─────────────────────────────────────────────────────────────────

-- Prisma model: Lead
CREATE TABLE IF NOT EXISTS public.leads (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id       text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  first_name   text NOT NULL,
  last_name    text NOT NULL,
  email        text,
  phone        text,
  company      text,
  title        text,
  source       public.lead_source NOT NULL DEFAULT 'website',
  status       public.lead_status NOT NULL DEFAULT 'new',
  value        double precision NOT NULL DEFAULT 0,
  notes        text,
  owner_id     text REFERENCES public.users (id) ON DELETE SET NULL,
  converted_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_org_id_status_idx  ON public.leads (org_id, status);
CREATE INDEX IF NOT EXISTS leads_org_id_owner_id_idx ON public.leads (org_id, owner_id);

-- Prisma model: Account (created before contacts/deals — they reference it)
CREATE TABLE IF NOT EXISTS public.accounts (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id     text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name       text NOT NULL,
  website    text,
  phone      text,
  industry   text,
  size       public.account_size,
  tier       public.account_tier NOT NULL DEFAULT 'standard',
  city       text,
  country    text,
  revenue    double precision,
  owner_id   text REFERENCES public.users (id) ON DELETE SET NULL,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounts_org_id_tier_idx    ON public.accounts (org_id, tier);
CREATE INDEX IF NOT EXISTS accounts_org_id_owner_id_idx ON public.accounts (org_id, owner_id);

-- Prisma model: Contact
CREATE TABLE IF NOT EXISTS public.contacts (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id     text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name  text NOT NULL,
  email      text,
  phone      text,
  title      text,
  account_id text REFERENCES public.accounts (id) ON DELETE SET NULL,
  lifecycle  public.lifecycle_stage NOT NULL DEFAULT 'lead',
  source     public.lead_source    NOT NULL DEFAULT 'website',
  owner_id   text REFERENCES public.users (id) ON DELETE SET NULL,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_org_id_lifecycle_idx ON public.contacts (org_id, lifecycle);
CREATE INDEX IF NOT EXISTS contacts_org_id_owner_id_idx   ON public.contacts (org_id, owner_id);
CREATE INDEX IF NOT EXISTS contacts_account_id_idx        ON public.contacts (account_id);

-- Prisma model: Deal
CREATE TABLE IF NOT EXISTS public.deals (
  id                text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id            text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name              text NOT NULL,
  account_id        text REFERENCES public.accounts (id) ON DELETE SET NULL,
  contact_id        text REFERENCES public.contacts (id) ON DELETE SET NULL,
  amount            double precision NOT NULL DEFAULT 0,
  stage             public.deal_stage NOT NULL DEFAULT 'qualification',
  probability       integer NOT NULL DEFAULT 20,
  expected_close_at timestamptz,
  closed_at         timestamptz,
  source            public.lead_source NOT NULL DEFAULT 'website',
  owner_id          text REFERENCES public.users (id) ON DELETE SET NULL,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deals_org_id_stage_idx    ON public.deals (org_id, stage);
CREATE INDEX IF NOT EXISTS deals_org_id_owner_id_idx ON public.deals (org_id, owner_id);
CREATE INDEX IF NOT EXISTS deals_account_id_idx      ON public.deals (account_id);
CREATE INDEX IF NOT EXISTS deals_contact_id_idx      ON public.deals (contact_id);

-- Prisma model: Task
-- created_by_id intentionally has NO foreign key (mirrors the Prisma schema,
-- which declares the field without a @relation); it stores the creator's user id.
CREATE TABLE IF NOT EXISTS public.tasks (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id        text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  status        public.task_status   NOT NULL DEFAULT 'not_started',
  priority      public.task_priority NOT NULL DEFAULT 'normal',
  due_at        timestamptz,
  related_type  public.related_entity_type,
  related_id    text,
  assignee_id   text REFERENCES public.users (id) ON DELETE SET NULL,
  created_by_id text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_org_id_status_idx ON public.tasks (org_id, status);
CREATE INDEX IF NOT EXISTS tasks_assignee_id_idx   ON public.tasks (assignee_id);
CREATE INDEX IF NOT EXISTS tasks_due_at_idx        ON public.tasks (due_at);

-- Prisma model: Activity (immutable log of interactions — no updated_at)
CREATE TABLE IF NOT EXISTS public.activities (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id       text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  type         public.activity_type NOT NULL DEFAULT 'note',
  subject      text NOT NULL,
  body         text,
  outcome      public.activity_outcome,
  duration_min integer,
  related_type public.related_entity_type,
  related_id   text,
  user_id      text REFERENCES public.users (id) ON DELETE SET NULL,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activities_org_id_type_idx ON public.activities (org_id, type);
CREATE INDEX IF NOT EXISTS activities_related_type_related_id_idx ON public.activities (related_type, related_id);

-- Prisma model: Product
CREATE TABLE IF NOT EXISTS public.products (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id        text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name          text NOT NULL,
  sku           text,
  category      text,
  unit_price    double precision NOT NULL DEFAULT 0,
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'one_time',
  active        boolean NOT NULL DEFAULT true,
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_org_id_idx ON public.products (org_id);

-- ── Automation & Messaging ───────────────────────────────────────────────────

-- Prisma model: Workflow (conditions/actions are JSON strings — matches the
-- Prisma String type; swap to jsonb later if you stop using Prisma strings)
CREATE TABLE IF NOT EXISTS public.workflows (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id      text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  trigger     public.workflow_trigger NOT NULL DEFAULT 'lead.created',
  conditions  text NOT NULL DEFAULT '[]',  -- JSON: [{field, operator, value}]
  actions     text NOT NULL DEFAULT '[]',  -- JSON: [{type, config}]
  active      boolean NOT NULL DEFAULT true,
  run_count   integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflows_org_id_active_idx ON public.workflows (org_id, active);

-- Prisma model: EmailTemplate
CREATE TABLE IF NOT EXISTS public.email_templates (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id     text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name       text NOT NULL,
  subject    text NOT NULL,
  body       text NOT NULL,
  category   public.email_template_category NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_templates_org_id_idx ON public.email_templates (org_id);

-- Prisma model: Campaign
CREATE TABLE IF NOT EXISTS public.campaigns (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id          text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name            text NOT NULL,
  template_id     text REFERENCES public.email_templates (id) ON DELETE SET NULL,
  segment         public.campaign_segment NOT NULL DEFAULT 'all',
  status          public.campaign_status  NOT NULL DEFAULT 'draft',
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count      integer NOT NULL DEFAULT 0,
  open_count      integer NOT NULL DEFAULT 0,
  click_count     integer NOT NULL DEFAULT 0,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaigns_org_id_status_idx ON public.campaigns (org_id, status);

-- ── Platform ─────────────────────────────────────────────────────────────────

-- Prisma model: Notification (no updated_at — created read/unread)
CREATE TABLE IF NOT EXISTS public.notifications (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id     text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text,
  type       public.notification_type NOT NULL DEFAULT 'info',
  read       boolean NOT NULL DEFAULT false,
  link       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_read_idx ON public.notifications (user_id, read);
CREATE INDEX IF NOT EXISTS notifications_org_id_idx       ON public.notifications (org_id);

-- Prisma model: Integration (config is a JSON string; secrets are masked by
-- the API before returning rows to the client)
CREATE TABLE IF NOT EXISTS public.integrations (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id       text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  provider     text NOT NULL, -- open catalog: supabase|vercel|github|resend|whatsapp|slack|stripe|zapier|google|mailchimp|twilio|hubspot (+ future providers)
  status       public.integration_provider_status NOT NULL DEFAULT 'connected',
  config       text NOT NULL DEFAULT '{}',
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integrations_org_id_provider_key UNIQUE (org_id, provider)
);

-- Prisma model: Invoice (billing history — no updated_at)
CREATE TABLE IF NOT EXISTS public.invoices (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id     text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  number     text NOT NULL,
  plan       public.plan_key      NOT NULL,
  cycle      public.billing_cycle NOT NULL DEFAULT 'monthly',
  seats      integer NOT NULL DEFAULT 1,
  amount     double precision NOT NULL,
  currency   text NOT NULL DEFAULT 'USD',
  status     public.invoice_status NOT NULL DEFAULT 'paid',
  date       timestamptz NOT NULL DEFAULT now(),
  due_at     timestamptz
);

CREATE INDEX IF NOT EXISTS invoices_org_id_idx ON public.invoices (org_id);

-- Prisma model: AuditLog (append-only trail — no updated_at)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id     text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id    text REFERENCES public.users (id) ON DELETE SET NULL,
  action     text NOT NULL, -- extensible vocabulary: signup|signin|create|update|delete|convert|invite|subscribe|connect|disconnect|send|import
  entity     text,
  entity_id  text,
  summary    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_org_id_created_at_idx ON public.audit_logs (org_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_org_id_entity_idx      ON public.audit_logs (org_id, entity);

-- =============================================================================
-- 3. users.email — case-insensitive uniqueness
-- -----------------------------------------------------------------------------
-- users_email_key (above) satisfies the Prisma-level @unique; this functional
-- unique index additionally guarantees that 'Alice@Example.com' and
-- 'alice@example.com' cannot coexist. The API lowercases emails anyway —
-- this is the database-level safety net.
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON public.users (lower(email));

-- =============================================================================
-- 4. users.auth_user_id — bridge to Supabase Auth (optional)
-- -----------------------------------------------------------------------------
-- The column itself is created with the table (see above). On Supabase we can
-- also attach a real foreign key to auth.users(id). This is guarded because
-- auth.users only exists on Supabase — the file stays runnable on a vanilla
-- PostgreSQL 15 server (for local docker testing) where the FK is skipped.
-- =============================================================================
COMMENT ON COLUMN public.users.auth_user_id IS
  'Optional link to a Supabase Auth user (auth.users.id). Backfill when migrating to Supabase Auth; RLS helpers already match on it.';

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL AND to_regclass('auth.users') IS NOT NULL THEN
    -- Column first (covers the edge case of a pre-existing users table).
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_user_id'
    ) THEN
      ALTER TABLE public.users ADD COLUMN auth_user_id uuid;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'users_auth_user_id_fkey'
        AND conrelid = 'public.users'::regclass
    ) THEN
      ALTER TABLE public.users
        ADD CONSTRAINT users_auth_user_id_fkey
        FOREIGN KEY (auth_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 5. updated_at maintenance
-- -----------------------------------------------------------------------------
-- One trigger function, attached to every table that has an updated_at
-- column (matches every Prisma model with @updatedAt):
--   users, organizations, leads, contacts, accounts, deals, tasks, products,
--   workflows, email_templates, campaigns, integrations
-- (sessions, memberships, activities, notifications, invoices and audit_logs
--  have no updatedAt in the Prisma schema and are intentionally skipped.)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.users;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.organizations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.leads;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.contacts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.accounts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.deals;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.tasks;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.products;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.workflows;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.email_templates;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.campaigns;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.integrations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 0001 complete. Continue with 0002_rls.sql (Row Level Security).
-- =============================================================================
