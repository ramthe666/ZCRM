-- =============================================================================
-- Nova CRM — 0006_prisma_compat.sql
-- Align the production schema with the deployed Prisma client.
-- =============================================================================
--
-- WHY THIS FILE EXISTS
--   The Prisma client deployed by scripts/vercel-build.sh is generated from
--   prisma/schema.postgres.prisma. That schema now maps every model to the
--   exact snake_case table/column names created by 0001_init.sql and 0004
--   (…/@@map("users"), @map("password_hash"), …), and every status-like field
--   is a plain Prisma `String`.
--
--   Prisma sends `String` parameters to PostgreSQL with the `text` type OID.
--   PostgreSQL has NO implicit/assignment cast from text to a native enum, so
--   every INSERT/UPDATE/WHERE against an enum-typed column fails with
--   `column "…" is of type <enum> but expression is of type text` (SQLSTATE
--   42804). This migration therefore converts the 29 enum-typed columns to
--   `text` while preserving EXACTLY the same value domains via CHECK
--   constraints — the database-level validation is identical, the app can
--   finally write, and existing rows are untouched.
--
-- WHAT IT DOES (and deliberately does NOT do)
--   * Converts 29 enum-typed columns → `text` (values preserved via
--     `USING <col>::text`), restoring plain text defaults where 0001 had them.
--   * Adds one CHECK constraint per converted column, listing the exact values
--     of the original enum — no domain is widened or narrowed.
--   * Handles the ONE RLS policy whose expression references a converted
--     column: `memberships_tenant_insert` (0002_rls.sql §6) has
--     `status = 'invited'` in its WITH CHECK, and PostgreSQL refuses to
--     ALTER COLUMN TYPE while any policy depends on the column
--     (SQLSTATE 0A000: "cannot alter type of a column used in a policy
--     definition"). This migration drops that policy immediately before the
--     conversion and recreates it — byte-identical to 0002 — immediately
--     after. No other policy in the schema references a converted column
--     (all other policies filter on org_id / user_id / id / current_setting).
--     The recreate is unguarded and idempotent (DROP IF EXISTS + CREATE), so
--     the policy is guaranteed to exist with the exact 0002 definition after
--     this file runs, in every partial-application scenario.
--   * Does NOT drop the 23 enum types (0003_verification.sql CHECK 2 still
--     passes if you re-run it — they are simply unused after this file).
--   * Does NOT touch any other policy, helper, trigger, index or grant from
--     0001–0005. ALTER COLUMN TYPE preserves RLS flags, policies and
--     triggers; indexes on converted columns are rebuilt automatically with
--     identical definitions.
--
-- APPLY ORDER
--   Run AFTER 0001 → 0002 → 0003 → 0004 → 0005 (0005 is optional).
--   Safe to re-run (idempotent): conversions are guarded on the column still
--   being enum-typed; constraints on not already existing; the
--   memberships_tenant_insert policy is dropped before the memberships.status
--   conversion and recreated (identical definition) afterwards — re-running
--   always leaves it in place (CHECK E verifies this).
--
--   If a previous attempt of this file failed with
--   `0A000: cannot alter type of a column used in a policy definition`,
--   just re-run THIS file from the top — every step is guarded, so whatever
--   was committed by the earlier attempt is skipped and the rest is applied.
--
-- Apply as the `postgres` role (Supabase Dashboard → SQL Editor → paste & Run,
-- or: psql "$DIRECT_URL" -f migrations/0006_prisma_compat.sql).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Preflight — abort early with a clear message if the base schema is missing
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.organizations') IS NULL
     OR to_regclass('public.leads') IS NULL THEN
    RAISE EXCEPTION '0006 preflight failed — core tables missing. Run 0001_init.sql through 0005_demo_seed.sql first.';
  END IF;
  IF to_regclass('public.invitations') IS NULL THEN
    RAISE EXCEPTION '0006 preflight failed — public.invitations missing. Run 0004_invitations.sql first.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. organizations — plan, billing_cycle, plan_status
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'organizations'
               AND column_name = 'plan' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.organizations
      ALTER COLUMN plan DROP DEFAULT,
      ALTER COLUMN plan TYPE text USING plan::text,
      ALTER COLUMN plan SET DEFAULT 'starter';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.organizations'::regclass
                   AND conname = 'organizations_plan_values_check' AND contype = 'c') THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_plan_values_check
      CHECK (plan IN ('starter', 'standard', 'professional', 'enterprise'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'organizations'
               AND column_name = 'billing_cycle' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.organizations
      ALTER COLUMN billing_cycle DROP DEFAULT,
      ALTER COLUMN billing_cycle TYPE text USING billing_cycle::text,
      ALTER COLUMN billing_cycle SET DEFAULT 'monthly';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.organizations'::regclass
                   AND conname = 'organizations_billing_cycle_values_check' AND contype = 'c') THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_billing_cycle_values_check
      CHECK (billing_cycle IN ('one_time', 'monthly', 'yearly'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'organizations'
               AND column_name = 'plan_status' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.organizations
      ALTER COLUMN plan_status DROP DEFAULT,
      ALTER COLUMN plan_status TYPE text USING plan_status::text,
      ALTER COLUMN plan_status SET DEFAULT 'trialing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.organizations'::regclass
                   AND conname = 'organizations_plan_status_values_check' AND contype = 'c') THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_plan_status_values_check
      CHECK (plan_status IN ('trialing', 'active', 'past_due', 'canceled'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. memberships — role, status
--
--    memberships.status is the ONLY converted column referenced by an RLS
--    policy (memberships_tenant_insert: `... AND status = 'invited'`, see
--    0002_rls.sql §6). PostgreSQL raises 0A000 "cannot alter type of a column
--    used in a policy definition" unless the dependent policy is dropped
--    first — so it is dropped inside the guard below and recreated, with the
--    exact 0002 definition, right after this block. memberships.role has NO
--    policy dependency (the role checks live inside the is_org_admin()
--    helper function, and function bodies never block ALTER COLUMN TYPE).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'memberships'
               AND column_name = 'role' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.memberships
      ALTER COLUMN role DROP DEFAULT,
      ALTER COLUMN role TYPE text USING role::text,
      ALTER COLUMN role SET DEFAULT 'member';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.memberships'::regclass
                   AND conname = 'memberships_role_values_check' AND contype = 'c') THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_role_values_check
      CHECK (role IN ('owner', 'admin', 'manager', 'member'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'memberships'
               AND column_name = 'status' AND data_type = 'USER-DEFINED') THEN
    -- 0A000 fix: this policy's WITH CHECK depends on memberships.status,
    -- so it MUST be dropped before the type change (recreated below).
    DROP POLICY IF EXISTS memberships_tenant_insert ON public.memberships;
    ALTER TABLE public.memberships
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE text USING status::text,
      ALTER COLUMN status SET DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.memberships'::regclass
                   AND conname = 'memberships_status_values_check' AND contype = 'c') THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_status_values_check
      CHECK (status IN ('active', 'invited'));
  END IF;
END $$;

-- Restore memberships_tenant_insert EXACTLY as 0002_rls.sql defines it
-- (self-healing: DROP IF EXISTS + CREATE is idempotent, so re-running this
--  file — or recovering from any partial application — always leaves the
--  policy in place with the original definition).
DROP POLICY IF EXISTS memberships_tenant_insert ON public.memberships;
CREATE POLICY memberships_tenant_insert ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.current_user_row_ids()) AND status = 'invited');

-- -----------------------------------------------------------------------------
-- 3. leads — source, status
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'leads'
               AND column_name = 'source' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.leads
      ALTER COLUMN source DROP DEFAULT,
      ALTER COLUMN source TYPE text USING source::text,
      ALTER COLUMN source SET DEFAULT 'website';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.leads'::regclass
                   AND conname = 'leads_source_values_check' AND contype = 'c') THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_source_values_check
      CHECK (source IN ('website', 'referral', 'ads', 'event', 'cold_call', 'social', 'partner'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'leads'
               AND column_name = 'status' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.leads
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE text USING status::text,
      ALTER COLUMN status SET DEFAULT 'new';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.leads'::regclass
                   AND conname = 'leads_status_values_check' AND contype = 'c') THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_status_values_check
      CHECK (status IN ('new', 'contacted', 'qualified', 'unqualified', 'converted'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. accounts — size (nullable), tier
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'accounts'
               AND column_name = 'size' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.accounts
      ALTER COLUMN size TYPE text USING size::text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.accounts'::regclass
                   AND conname = 'accounts_size_values_check' AND contype = 'c') THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_size_values_check
      CHECK (size IN ('1-10', '11-50', '51-200', '201-1000', '1000+') OR size IS NULL);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'accounts'
               AND column_name = 'tier' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.accounts
      ALTER COLUMN tier DROP DEFAULT,
      ALTER COLUMN tier TYPE text USING tier::text,
      ALTER COLUMN tier SET DEFAULT 'standard';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.accounts'::regclass
                   AND conname = 'accounts_tier_values_check' AND contype = 'c') THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_tier_values_check
      CHECK (tier IN ('standard', 'silver', 'gold', 'platinum'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5. contacts — lifecycle, source
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'contacts'
               AND column_name = 'lifecycle' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.contacts
      ALTER COLUMN lifecycle DROP DEFAULT,
      ALTER COLUMN lifecycle TYPE text USING lifecycle::text,
      ALTER COLUMN lifecycle SET DEFAULT 'lead';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.contacts'::regclass
                   AND conname = 'contacts_lifecycle_values_check' AND contype = 'c') THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_lifecycle_values_check
      CHECK (lifecycle IN ('lead', 'marketing_qualified', 'sales_qualified', 'customer', 'evangelist'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'contacts'
               AND column_name = 'source' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.contacts
      ALTER COLUMN source DROP DEFAULT,
      ALTER COLUMN source TYPE text USING source::text,
      ALTER COLUMN source SET DEFAULT 'website';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.contacts'::regclass
                   AND conname = 'contacts_source_values_check' AND contype = 'c') THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_source_values_check
      CHECK (source IN ('website', 'referral', 'ads', 'event', 'cold_call', 'social', 'partner'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. deals — stage, source
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'deals'
               AND column_name = 'stage' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.deals
      ALTER COLUMN stage DROP DEFAULT,
      ALTER COLUMN stage TYPE text USING stage::text,
      ALTER COLUMN stage SET DEFAULT 'qualification';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.deals'::regclass
                   AND conname = 'deals_stage_values_check' AND contype = 'c') THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_stage_values_check
      CHECK (stage IN ('qualification', 'needs_analysis', 'value_prop', 'negotiation', 'closed_won', 'closed_lost'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'deals'
               AND column_name = 'source' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.deals
      ALTER COLUMN source DROP DEFAULT,
      ALTER COLUMN source TYPE text USING source::text,
      ALTER COLUMN source SET DEFAULT 'website';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.deals'::regclass
                   AND conname = 'deals_source_values_check' AND contype = 'c') THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_source_values_check
      CHECK (source IN ('website', 'referral', 'ads', 'event', 'cold_call', 'social', 'partner'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7. tasks — status, priority, related_type (nullable)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'tasks'
               AND column_name = 'status' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.tasks
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE text USING status::text,
      ALTER COLUMN status SET DEFAULT 'not_started';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.tasks'::regclass
                   AND conname = 'tasks_status_values_check' AND contype = 'c') THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_status_values_check
      CHECK (status IN ('not_started', 'in_progress', 'completed', 'deferred'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'tasks'
               AND column_name = 'priority' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.tasks
      ALTER COLUMN priority DROP DEFAULT,
      ALTER COLUMN priority TYPE text USING priority::text,
      ALTER COLUMN priority SET DEFAULT 'normal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.tasks'::regclass
                   AND conname = 'tasks_priority_values_check' AND contype = 'c') THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_priority_values_check
      CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'tasks'
               AND column_name = 'related_type' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.tasks
      ALTER COLUMN related_type TYPE text USING related_type::text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.tasks'::regclass
                   AND conname = 'tasks_related_type_values_check' AND contype = 'c') THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_related_type_values_check
      CHECK (related_type IN ('lead', 'contact', 'account', 'deal') OR related_type IS NULL);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 8. activities — type, outcome (nullable), related_type (nullable)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'activities'
               AND column_name = 'type' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.activities
      ALTER COLUMN type DROP DEFAULT,
      ALTER COLUMN type TYPE text USING type::text,
      ALTER COLUMN type SET DEFAULT 'note';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.activities'::regclass
                   AND conname = 'activities_type_values_check' AND contype = 'c') THEN
    ALTER TABLE public.activities
      ADD CONSTRAINT activities_type_values_check
      CHECK (type IN ('note', 'call', 'meeting', 'email', 'whatsapp', 'task'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'activities'
               AND column_name = 'outcome' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.activities
      ALTER COLUMN outcome TYPE text USING outcome::text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.activities'::regclass
                   AND conname = 'activities_outcome_values_check' AND contype = 'c') THEN
    ALTER TABLE public.activities
      ADD CONSTRAINT activities_outcome_values_check
      CHECK (outcome IN ('connected', 'no_answer', 'left_voicemail', 'scheduled', 'interested', 'not_interested') OR outcome IS NULL);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'activities'
               AND column_name = 'related_type' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.activities
      ALTER COLUMN related_type TYPE text USING related_type::text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.activities'::regclass
                   AND conname = 'activities_related_type_values_check' AND contype = 'c') THEN
    ALTER TABLE public.activities
      ADD CONSTRAINT activities_related_type_values_check
      CHECK (related_type IN ('lead', 'contact', 'account', 'deal') OR related_type IS NULL);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 9. products — billing_cycle
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'products'
               AND column_name = 'billing_cycle' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.products
      ALTER COLUMN billing_cycle DROP DEFAULT,
      ALTER COLUMN billing_cycle TYPE text USING billing_cycle::text,
      ALTER COLUMN billing_cycle SET DEFAULT 'one_time';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.products'::regclass
                   AND conname = 'products_billing_cycle_values_check' AND contype = 'c') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_billing_cycle_values_check
      CHECK (billing_cycle IN ('one_time', 'monthly', 'yearly'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 10. workflows — trigger
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'workflows'
               AND column_name = 'trigger' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.workflows
      ALTER COLUMN trigger DROP DEFAULT,
      ALTER COLUMN trigger TYPE text USING trigger::text,
      ALTER COLUMN trigger SET DEFAULT 'lead.created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.workflows'::regclass
                   AND conname = 'workflows_trigger_values_check' AND contype = 'c') THEN
    ALTER TABLE public.workflows
      ADD CONSTRAINT workflows_trigger_values_check
      CHECK (trigger IN ('lead.created', 'lead.status_changed', 'deal.created', 'deal.stage_changed', 'contact.created', 'task.created'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 11. email_templates — category
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'email_templates'
               AND column_name = 'category' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.email_templates
      ALTER COLUMN category DROP DEFAULT,
      ALTER COLUMN category TYPE text USING category::text,
      ALTER COLUMN category SET DEFAULT 'general';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.email_templates'::regclass
                   AND conname = 'email_templates_category_values_check' AND contype = 'c') THEN
    ALTER TABLE public.email_templates
      ADD CONSTRAINT email_templates_category_values_check
      CHECK (category IN ('general', 'sales', 'onboarding', 'support', 'marketing'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 12. campaigns — segment, status
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'campaigns'
               AND column_name = 'segment' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.campaigns
      ALTER COLUMN segment DROP DEFAULT,
      ALTER COLUMN segment TYPE text USING segment::text,
      ALTER COLUMN segment SET DEFAULT 'all';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.campaigns'::regclass
                   AND conname = 'campaigns_segment_values_check' AND contype = 'c') THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_segment_values_check
      CHECK (segment IN ('all', 'customers', 'prospects', 'newsletter'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'campaigns'
               AND column_name = 'status' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.campaigns
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE text USING status::text,
      ALTER COLUMN status SET DEFAULT 'draft';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.campaigns'::regclass
                   AND conname = 'campaigns_status_values_check' AND contype = 'c') THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_status_values_check
      CHECK (status IN ('draft', 'sending', 'sent'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 13. notifications — type
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'notifications'
               AND column_name = 'type' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.notifications
      ALTER COLUMN type DROP DEFAULT,
      ALTER COLUMN type TYPE text USING type::text,
      ALTER COLUMN type SET DEFAULT 'info';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.notifications'::regclass
                   AND conname = 'notifications_type_values_check' AND contype = 'c') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_values_check
      CHECK (type IN ('info', 'success', 'warning', 'deal', 'task', 'team', 'billing'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 14. integrations — status
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'integrations'
               AND column_name = 'status' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.integrations
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE text USING status::text,
      ALTER COLUMN status SET DEFAULT 'connected';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.integrations'::regclass
                   AND conname = 'integrations_status_values_check' AND contype = 'c') THEN
    ALTER TABLE public.integrations
      ADD CONSTRAINT integrations_status_values_check
      CHECK (status IN ('connected', 'error', 'disabled'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 15. invoices — plan (no default), cycle, status
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'invoices'
               AND column_name = 'plan' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.invoices
      ALTER COLUMN plan TYPE text USING plan::text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.invoices'::regclass
                   AND conname = 'invoices_plan_values_check' AND contype = 'c') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_plan_values_check
      CHECK (plan IN ('starter', 'standard', 'professional', 'enterprise'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'invoices'
               AND column_name = 'cycle' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.invoices
      ALTER COLUMN cycle DROP DEFAULT,
      ALTER COLUMN cycle TYPE text USING cycle::text,
      ALTER COLUMN cycle SET DEFAULT 'monthly';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.invoices'::regclass
                   AND conname = 'invoices_cycle_values_check' AND contype = 'c') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_cycle_values_check
      CHECK (cycle IN ('one_time', 'monthly', 'yearly'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'invoices'
               AND column_name = 'status' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE public.invoices
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE text USING status::text,
      ALTER COLUMN status SET DEFAULT 'paid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.invoices'::regclass
                   AND conname = 'invoices_status_values_check' AND contype = 'c') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_status_values_check
      CHECK (status IN ('paid', 'open', 'void'));
  END IF;
END $$;

-- =============================================================================
-- 16. Verification (0003-style DO blocks — RAISE EXCEPTION on failure)
-- =============================================================================

-- CHECK A — all 29 converted columns exist and are now plain `text`
DO $$
DECLARE
  v_cols text[] := ARRAY[
    'organizations.plan',            'organizations.billing_cycle', 'organizations.plan_status',
    'memberships.role',              'memberships.status',
    'leads.source',                  'leads.status',
    'accounts.size',                 'accounts.tier',
    'contacts.lifecycle',            'contacts.source',
    'deals.stage',                   'deals.source',
    'tasks.status',                  'tasks.priority',               'tasks.related_type',
    'activities.type',               'activities.outcome',           'activities.related_type',
    'products.billing_cycle',
    'workflows.trigger',
    'email_templates.category',
    'campaigns.segment',             'campaigns.status',
    'notifications.type',
    'integrations.status',
    'invoices.plan',                 'invoices.cycle',               'invoices.status'
  ];
  v_bad   text;
  v_count int;
BEGIN
  -- Count the BAD columns: anything that is not `text` — or missing entirely.
  -- LEFT JOIN + IS DISTINCT FROM (not `<>`) so a NULL data_type from a missing
  -- column is caught too (`NULL <> 'text'` would be NULL and silently skip it).
  SELECT string_agg(t.t || ' (' || coalesce(c.data_type, 'MISSING') || ')', ', ' ORDER BY t.t), count(*)
  INTO v_bad, v_count
  FROM unnest(v_cols) AS t(t)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name  = split_part(t.t, '.', 1)
   AND c.column_name = split_part(t.t, '.', 2)
  WHERE c.data_type IS DISTINCT FROM 'text';

  IF v_count <> 0 OR v_bad IS NOT NULL THEN
    RAISE EXCEPTION '0006 CHECK A FAILED — % of 29 columns are missing or not text: %', v_count, coalesce(v_bad, '<unexpected>');
  END IF;
  RAISE NOTICE '0006 CHECK A OK — all 29 columns are now text.';
END $$;

-- CHECK B — all 29 value-domain CHECK constraints exist
DO $$
DECLARE
  v_missing text;
  v_count   int;
BEGIN
  WITH expected(name) AS (VALUES
    ('organizations_plan_values_check'),            ('organizations_billing_cycle_values_check'), ('organizations_plan_status_values_check'),
    ('memberships_role_values_check'),              ('memberships_status_values_check'),
    ('leads_source_values_check'),                  ('leads_status_values_check'),
    ('accounts_size_values_check'),                 ('accounts_tier_values_check'),
    ('contacts_lifecycle_values_check'),            ('contacts_source_values_check'),
    ('deals_stage_values_check'),                   ('deals_source_values_check'),
    ('tasks_status_values_check'),                  ('tasks_priority_values_check'),                ('tasks_related_type_values_check'),
    ('activities_type_values_check'),               ('activities_outcome_values_check'),           ('activities_related_type_values_check'),
    ('products_billing_cycle_values_check'),
    ('workflows_trigger_values_check'),
    ('email_templates_category_values_check'),
    ('campaigns_segment_values_check'),             ('campaigns_status_values_check'),
    ('notifications_type_values_check'),
    ('integrations_status_values_check'),
    ('invoices_plan_values_check'),                 ('invoices_cycle_values_check'),               ('invoices_status_values_check')
  )
  SELECT string_agg(e.name, ', ' ORDER BY e.name), count(*)
  INTO v_missing, v_count
  FROM expected e
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint pc
    JOIN pg_namespace n ON n.oid = pc.connamespace
    WHERE n.nspname = 'public' AND pc.conname = e.name AND pc.contype = 'c'
  );

  IF v_count <> 0 THEN
    RAISE EXCEPTION '0006 CHECK B FAILED — missing CHECK constraints: %', v_missing;
  END IF;
  RAISE NOTICE '0006 CHECK B OK — all 29 value-domain CHECK constraints present.';
END $$;

-- CHECK C — RLS is still ENABLED + FORCED on all 19 tables (0006 must not
-- disturb the security posture installed by 0002/0004)
DO $$
DECLARE
  v_fail text;
BEGIN
  WITH expected(t) AS (VALUES
    ('users'), ('sessions'), ('organizations'), ('memberships'), ('invitations'),
    ('leads'), ('accounts'), ('contacts'), ('deals'), ('tasks'), ('activities'),
    ('products'), ('workflows'), ('email_templates'), ('campaigns'),
    ('notifications'), ('integrations'), ('invoices'), ('audit_logs')
  )
  SELECT string_agg(e.t, ', ' ORDER BY e.t)
  INTO v_fail
  FROM expected e
  JOIN pg_class c     ON c.relname = e.t
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE NOT (c.relrowsecurity AND c.relforcerowsecurity);

  IF v_fail IS NOT NULL THEN
    RAISE EXCEPTION '0006 CHECK C FAILED — RLS no longer enabled+forced on: %', v_fail;
  END IF;
  RAISE NOTICE '0006 CHECK C OK — RLS still ENABLED + FORCED on all 19 tables.';
END $$;

-- CHECK D — set_updated_at triggers survived the table rewrites
DO $$
DECLARE
  v_missing text;
BEGIN
  WITH expected(t) AS (VALUES
    ('users'), ('organizations'), ('invitations'), ('leads'), ('contacts'), ('accounts'),
    ('deals'), ('tasks'), ('products'), ('workflows'), ('email_templates'),
    ('campaigns'), ('integrations')
  )
  SELECT string_agg(e.t, ', ' ORDER BY e.t)
  INTO v_missing
  FROM expected e
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
    JOIN pg_class c     ON c.oid = tg.tgrelid AND c.relname = e.t
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE tg.tgname = 'set_updated_at' AND NOT tg.tgisinternal
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0006 CHECK D FAILED — set_updated_at trigger missing on: %', v_missing;
  END IF;
  RAISE NOTICE '0006 CHECK D OK — set_updated_at triggers intact on all 13 tables.';
END $$;

-- CHECK E — memberships_tenant_insert was dropped for the memberships.status
-- conversion and MUST be back afterwards, byte-identical to 0002_rls.sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c     ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relname = 'memberships'
      AND p.polname = 'memberships_tenant_insert'
  ) THEN
    RAISE EXCEPTION '0006 CHECK E FAILED — memberships_tenant_insert policy is missing (it must be recreated after the memberships.status conversion)';
  END IF;
  RAISE NOTICE '0006 CHECK E OK — memberships_tenant_insert policy restored.';
END $$;

-- =============================================================================
-- 0006 complete.
--   * 29 enum columns → text (values preserved, domains enforced by CHECKs)
--   * 23 native enum types kept (unused) so 0003_verification.sql stays green
--   * memberships_tenant_insert dropped around the status conversion and
--     recreated byte-identical (the ONLY policy touched — see §2); every
--     other policy, helper function, trigger, index and grant: untouched
--   * prisma/schema.postgres.prisma now maps 1:1 onto this database —
--     redeploy the app (scripts/vercel-build.sh) and sign-up will work.
-- =============================================================================
