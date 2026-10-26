-- =============================================================================
-- Nova CRM — 0002_rls.sql
-- Row Level Security — the tenant isolation layer for Supabase (PostgreSQL 15+)
-- =============================================================================
--
-- THE MODEL
--   Every tenant row carries `org_id`. Access is decided per ROLE:
--
--   anon            Public/anonymous Supabase requests (anon key only).
--                   This file revokes every table privilege from anon.
--
--   authenticated   Signed-in Supabase users (supabase-js / PostgREST with a
--                   user JWT). They only ever see/modify rows of organizations
--                   where they hold an ACTIVE membership — enforced by the
--                   *_tenant_* policies via public.current_user_org_ids().
--
--   nova_app        Dedicated LOGIN role for the Next.js API (Prisma direct
--                   connection). Deliberately NOT BYPASSRLS. The API wraps
--                   each request in a transaction and pins the tenant with
--                   `SET LOCAL app.org_id = '<org-id>'`; every *_app_* policy
--                   then restricts reads AND writes to that single org.
--                   A forgotten WHERE clause or an SQL injection can no longer
--                   cross tenants even on the Prisma path.
--
--   service_role    Supabase's server role (has BYPASSRLS). Reserved for
--                   platform operations: organization creation, billing
--                   (invoices), support tooling. Never expose its key.
--
--   postgres        The table OWNER (Dashboard SQL Editor / direct admin
--                   connections). We ENABLE **and FORCE** RLS so the owner is
--                   policy-checked too. Since the owner could always edit or
--                   drop policies at will, RLS can never truly constrain it —
--                   so we re-grant full access explicitly via
--                   {table}_owner_admin policies. That explicit grant is also
--                   REQUIRED for correctness: the SECURITY DEFINER helpers
--                   below run as the owner and must read `memberships` and
--                   `users` without recursing into the tenant policies.
--
-- WHY EVERY POLICY IS ROLE-TARGETED (`TO <role>`)
--   With FORCE ROW LEVEL SECURITY the owner itself is subject to policies.
--   If the tenant policies applied to all roles, the helper functions (which
--   execute as the owner) would evaluate a tenant policy, which calls the
--   helper again — infinite recursion. Scoping each policy set to exactly
--   one role (authenticated | nova_app | postgres) keeps the policy graph
--   acyclic and makes the effective permissions easy to audit:
--
--     *_tenant_*    → authenticated: CRUD on rows of orgs with ACTIVE membership
--     *_own_*       → authenticated: row-owner exceptions (notifications)
--     *_admin_*     → authenticated, gated by is_org_admin()
--     *_self_*      → authenticated: own users row only
--     *_app_*       → nova_app: trusted server role, pinned by app.org_id
--     *_owner_admin → postgres: table-owner escape hatch (see above)
--
-- SESSIONS & USERS (custom auth)
--   Nova CRM ships with its own session auth (scrypt + httpOnly cookie), so
--   the Next.js API — not PostgREST — owns users/sessions. End-user roles
--   (anon/authenticated) get NOTHING on `sessions` (explicitly revoked) and
--   only self-service policies on `users`. nova_app keeps policy-guarded
--   access so signup/login/logout work through Prisma.
--
-- IDEMPOTENCY
--   Every policy is preceded by DROP POLICY IF EXISTS, so the whole file can
--   be re-run safely. ALTER TABLE ... ENABLE/FORCE ROW LEVEL SECURITY is
--   naturally idempotent; functions use CREATE OR REPLACE.
--
-- RUN AS the postgres role (Dashboard SQL Editor or psql as postgres).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Preflight — this file requires Supabase platform roles
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Role "authenticated" not found. 0002_rls.sql targets Supabase (which provides anon/authenticated/service_role and the auth schema). Aborting.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    RAISE EXCEPTION 'Role "anon" not found. 0002_rls.sql targets Supabase. Aborting.';
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'Function auth.uid() not found — this database is not a Supabase project. Aborting.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Helper functions (RLS building blocks)
-- -----------------------------------------------------------------------------
-- All helpers are:
--   * SECURITY DEFINER — they run as their owner (postgres). Combined with the
--     *_owner_admin policies this lets them read memberships/users without
--     hitting (or recursing into) the tenant policies.
--   * STABLE — same answer within a statement, so the planner can evaluate
--     them once per query (InitPlan) instead of once per row.
--   * SET search_path = public — immune to search_path hijacking; every
--     cross-schema call (auth.uid()) stays fully qualified.
--
-- current_user_row_ids() is the internal building block: it returns every
-- public.users.id that belongs to the caller — matching BOTH the "Supabase
-- Auth uuid used as users.id" style and the "custom cuid id linked through
-- users.auth_user_id" style, so the PostgREST path keeps working after a
-- later switch to Supabase Auth.
-- -----------------------------------------------------------------------------

-- All user-row ids of the caller (direct uuid match or auth_user_id link).
CREATE OR REPLACE FUNCTION public.current_user_row_ids()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.users AS u
  WHERE u.id = auth.uid()::text
     OR u.auth_user_id = auth.uid();
$$;

-- Orgs where the caller has an ACTIVE membership (the tenant scope).
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.org_id
  FROM public.memberships AS m
  WHERE m.status = 'active'
    AND m.user_id IN (SELECT public.current_user_row_ids());
$$;

-- Is the caller an active member of this org?
CREATE OR REPLACE FUNCTION public.is_org_member(org_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = is_org_member.org_id
      AND m.status = 'active'
      AND m.user_id IN (SELECT public.current_user_row_ids())
  );
$$;

-- Is the caller an owner or admin of this org?
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = is_org_admin.org_id
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
      AND m.user_id IN (SELECT public.current_user_row_ids())
  );
$$;

-- Is the caller THE owner of this org? (reserved for the most sensitive ops)
CREATE OR REPLACE FUNCTION public.is_org_owner(org_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = is_org_owner.org_id
      AND m.status = 'active'
      AND m.role = 'owner'
      AND m.user_id IN (SELECT public.current_user_row_ids())
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. The application role: nova_app
-- -----------------------------------------------------------------------------
-- Dedicated LOGIN role for the Next.js API (Prisma connection). Deliberately:
--   NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS
-- so RLS ALWAYS applies to it. Set its password out-of-band (never in SQL):
--   ALTER ROLE nova_app WITH PASSWORD '<strong-password>';
-- and connect with:
--   postgresql://nova_app:<password>@<pooler-host>:6543/postgres?pgbouncer=true
--
-- The DO block makes this section re-runnable (role created only if missing).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nova_app') THEN
    CREATE ROLE nova_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

-- Let the owner (e.g. Dashboard SQL Editor) test strict mode via
-- `SET ROLE nova_app` — used by the demos in 0003_verification.sql.
GRANT nova_app TO postgres;

-- -----------------------------------------------------------------------------
-- 3. Enable + FORCE Row Level Security on every table
-- -----------------------------------------------------------------------------
--   ENABLE → policies apply to non-owner roles (anon / authenticated / nova_app).
--   FORCE  → policies also apply to the table owner (postgres). A connection
--            that accidentally uses the owner role still goes through the
--            *_owner_admin policies below instead of silently bypassing RLS.
-- -----------------------------------------------------------------------------
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.memberships       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships       FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.deals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.workflows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.email_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.campaigns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.integrations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs        FORCE  ROW LEVEL SECURITY;

-- ===============================================================================
-- 4. Tenant CRUD — authenticated users (supabase-js / PostgREST)
-- ===============================================================================

-- The standard multi-tenant shape, applied to every org-scoped CRM table:
--   select → USING  org_id IN (SELECT public.current_user_org_ids())
--   insert → WITH CHECK org_id IN (SELECT public.current_user_org_ids())
--   update → USING + WITH CHECK the same predicate (row must stay in-org)
--   delete → USING the same predicate
-- A user with no ACTIVE membership anywhere sees exactly zero rows.
-- -----------------------------------------------------------------------------

-- -------------------------------------------------------------------------------
-- leads — Leads — sales prospects
-- -------------------------------------------------------------------------------

-- Active members can read rows only inside their own organizations.
DROP POLICY IF EXISTS leads_tenant_select ON public.leads;
CREATE POLICY leads_tenant_select ON public.leads
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can create rows only inside their own organizations.
DROP POLICY IF EXISTS leads_tenant_insert ON public.leads;
CREATE POLICY leads_tenant_insert ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can update rows only inside their own organizations (both the existing and the new row must belong to a member org).
DROP POLICY IF EXISTS leads_tenant_update ON public.leads;
CREATE POLICY leads_tenant_update ON public.leads
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can delete rows only inside their own organizations.
DROP POLICY IF EXISTS leads_tenant_delete ON public.leads;
CREATE POLICY leads_tenant_delete ON public.leads
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- -------------------------------------------------------------------------------
-- contacts — Contacts — people records
-- -------------------------------------------------------------------------------

-- Active members can read rows only inside their own organizations.
DROP POLICY IF EXISTS contacts_tenant_select ON public.contacts;
CREATE POLICY contacts_tenant_select ON public.contacts
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can create rows only inside their own organizations.
DROP POLICY IF EXISTS contacts_tenant_insert ON public.contacts;
CREATE POLICY contacts_tenant_insert ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can update rows only inside their own organizations (both the existing and the new row must belong to a member org).
DROP POLICY IF EXISTS contacts_tenant_update ON public.contacts;
CREATE POLICY contacts_tenant_update ON public.contacts
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can delete rows only inside their own organizations.
DROP POLICY IF EXISTS contacts_tenant_delete ON public.contacts;
CREATE POLICY contacts_tenant_delete ON public.contacts
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- -------------------------------------------------------------------------------
-- accounts — Accounts — companies
-- -------------------------------------------------------------------------------

-- Active members can read rows only inside their own organizations.
DROP POLICY IF EXISTS accounts_tenant_select ON public.accounts;
CREATE POLICY accounts_tenant_select ON public.accounts
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can create rows only inside their own organizations.
DROP POLICY IF EXISTS accounts_tenant_insert ON public.accounts;
CREATE POLICY accounts_tenant_insert ON public.accounts
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can update rows only inside their own organizations (both the existing and the new row must belong to a member org).
DROP POLICY IF EXISTS accounts_tenant_update ON public.accounts;
CREATE POLICY accounts_tenant_update ON public.accounts
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can delete rows only inside their own organizations.
DROP POLICY IF EXISTS accounts_tenant_delete ON public.accounts;
CREATE POLICY accounts_tenant_delete ON public.accounts
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- -------------------------------------------------------------------------------
-- deals — Deals — opportunities
-- -------------------------------------------------------------------------------

-- Active members can read rows only inside their own organizations.
DROP POLICY IF EXISTS deals_tenant_select ON public.deals;
CREATE POLICY deals_tenant_select ON public.deals
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can create rows only inside their own organizations.
DROP POLICY IF EXISTS deals_tenant_insert ON public.deals;
CREATE POLICY deals_tenant_insert ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can update rows only inside their own organizations (both the existing and the new row must belong to a member org).
DROP POLICY IF EXISTS deals_tenant_update ON public.deals;
CREATE POLICY deals_tenant_update ON public.deals
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can delete rows only inside their own organizations.
DROP POLICY IF EXISTS deals_tenant_delete ON public.deals;
CREATE POLICY deals_tenant_delete ON public.deals
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- -------------------------------------------------------------------------------
-- tasks — Tasks — follow-ups
-- -------------------------------------------------------------------------------

-- Active members can read rows only inside their own organizations.
DROP POLICY IF EXISTS tasks_tenant_select ON public.tasks;
CREATE POLICY tasks_tenant_select ON public.tasks
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can create rows only inside their own organizations.
DROP POLICY IF EXISTS tasks_tenant_insert ON public.tasks;
CREATE POLICY tasks_tenant_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can update rows only inside their own organizations (both the existing and the new row must belong to a member org).
DROP POLICY IF EXISTS tasks_tenant_update ON public.tasks;
CREATE POLICY tasks_tenant_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can delete rows only inside their own organizations.
DROP POLICY IF EXISTS tasks_tenant_delete ON public.tasks;
CREATE POLICY tasks_tenant_delete ON public.tasks
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- -------------------------------------------------------------------------------
-- activities — Activities — interaction log
-- -------------------------------------------------------------------------------

-- Active members can read rows only inside their own organizations.
DROP POLICY IF EXISTS activities_tenant_select ON public.activities;
CREATE POLICY activities_tenant_select ON public.activities
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can create rows only inside their own organizations.
DROP POLICY IF EXISTS activities_tenant_insert ON public.activities;
CREATE POLICY activities_tenant_insert ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can update rows only inside their own organizations (both the existing and the new row must belong to a member org).
DROP POLICY IF EXISTS activities_tenant_update ON public.activities;
CREATE POLICY activities_tenant_update ON public.activities
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can delete rows only inside their own organizations.
DROP POLICY IF EXISTS activities_tenant_delete ON public.activities;
CREATE POLICY activities_tenant_delete ON public.activities
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- -------------------------------------------------------------------------------
-- products — Products — price book
-- -------------------------------------------------------------------------------

-- Active members can read rows only inside their own organizations.
DROP POLICY IF EXISTS products_tenant_select ON public.products;
CREATE POLICY products_tenant_select ON public.products
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can create rows only inside their own organizations.
DROP POLICY IF EXISTS products_tenant_insert ON public.products;
CREATE POLICY products_tenant_insert ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can update rows only inside their own organizations (both the existing and the new row must belong to a member org).
DROP POLICY IF EXISTS products_tenant_update ON public.products;
CREATE POLICY products_tenant_update ON public.products
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can delete rows only inside their own organizations.
DROP POLICY IF EXISTS products_tenant_delete ON public.products;
CREATE POLICY products_tenant_delete ON public.products
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- -------------------------------------------------------------------------------
-- workflows — Workflows — automation rules
-- -------------------------------------------------------------------------------

-- Active members can read rows only inside their own organizations.
DROP POLICY IF EXISTS workflows_tenant_select ON public.workflows;
CREATE POLICY workflows_tenant_select ON public.workflows
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can create rows only inside their own organizations.
DROP POLICY IF EXISTS workflows_tenant_insert ON public.workflows;
CREATE POLICY workflows_tenant_insert ON public.workflows
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can update rows only inside their own organizations (both the existing and the new row must belong to a member org).
DROP POLICY IF EXISTS workflows_tenant_update ON public.workflows;
CREATE POLICY workflows_tenant_update ON public.workflows
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can delete rows only inside their own organizations.
DROP POLICY IF EXISTS workflows_tenant_delete ON public.workflows;
CREATE POLICY workflows_tenant_delete ON public.workflows
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- -------------------------------------------------------------------------------
-- email_templates — Email templates
-- -------------------------------------------------------------------------------

-- Active members can read rows only inside their own organizations.
DROP POLICY IF EXISTS email_templates_tenant_select ON public.email_templates;
CREATE POLICY email_templates_tenant_select ON public.email_templates
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can create rows only inside their own organizations.
DROP POLICY IF EXISTS email_templates_tenant_insert ON public.email_templates;
CREATE POLICY email_templates_tenant_insert ON public.email_templates
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can update rows only inside their own organizations (both the existing and the new row must belong to a member org).
DROP POLICY IF EXISTS email_templates_tenant_update ON public.email_templates;
CREATE POLICY email_templates_tenant_update ON public.email_templates
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can delete rows only inside their own organizations.
DROP POLICY IF EXISTS email_templates_tenant_delete ON public.email_templates;
CREATE POLICY email_templates_tenant_delete ON public.email_templates
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- -------------------------------------------------------------------------------
-- campaigns — Campaigns — email blasts
-- -------------------------------------------------------------------------------

-- Active members can read rows only inside their own organizations.
DROP POLICY IF EXISTS campaigns_tenant_select ON public.campaigns;
CREATE POLICY campaigns_tenant_select ON public.campaigns
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can create rows only inside their own organizations.
DROP POLICY IF EXISTS campaigns_tenant_insert ON public.campaigns;
CREATE POLICY campaigns_tenant_insert ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can update rows only inside their own organizations (both the existing and the new row must belong to a member org).
DROP POLICY IF EXISTS campaigns_tenant_update ON public.campaigns;
CREATE POLICY campaigns_tenant_update ON public.campaigns
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can delete rows only inside their own organizations.
DROP POLICY IF EXISTS campaigns_tenant_delete ON public.campaigns;
CREATE POLICY campaigns_tenant_delete ON public.campaigns
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- -------------------------------------------------------------------------------
-- integrations — Integrations — per-org provider settings
-- -------------------------------------------------------------------------------

-- Active members can read rows only inside their own organizations.
DROP POLICY IF EXISTS integrations_tenant_select ON public.integrations;
CREATE POLICY integrations_tenant_select ON public.integrations
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can create rows only inside their own organizations.
DROP POLICY IF EXISTS integrations_tenant_insert ON public.integrations;
CREATE POLICY integrations_tenant_insert ON public.integrations
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can update rows only inside their own organizations (both the existing and the new row must belong to a member org).
DROP POLICY IF EXISTS integrations_tenant_update ON public.integrations;
CREATE POLICY integrations_tenant_update ON public.integrations
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can delete rows only inside their own organizations.
DROP POLICY IF EXISTS integrations_tenant_delete ON public.integrations;
CREATE POLICY integrations_tenant_delete ON public.integrations
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- ===============================================================================
-- 5. Notifications — tenant CRUD + personal inbox exceptions
-- ===============================================================================

-- Notifications get the standard tenant CRUD set PLUS two "personal inbox"
-- policies: a user can always see and update (mark read) their OWN
-- notifications even if they have no active org membership (e.g. membership
-- suspended, invite pending, or org deleted cascade left nothing behind).
-- -----------------------------------------------------------------------------

-- -------------------------------------------------------------------------------
-- notifications — tenant CRUD (standard shape)
-- -------------------------------------------------------------------------------

-- Active members can read notifications inside their own organizations.
DROP POLICY IF EXISTS notifications_tenant_select ON public.notifications;
CREATE POLICY notifications_tenant_select ON public.notifications
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can create notifications only inside their own orgs.
DROP POLICY IF EXISTS notifications_tenant_insert ON public.notifications;
CREATE POLICY notifications_tenant_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can update notifications only inside their own orgs.
DROP POLICY IF EXISTS notifications_tenant_update ON public.notifications;
CREATE POLICY notifications_tenant_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- Active members can delete notifications only inside their own orgs.
DROP POLICY IF EXISTS notifications_tenant_delete ON public.notifications;
CREATE POLICY notifications_tenant_delete ON public.notifications
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- -------------------------------------------------------------------------------
-- notifications — personal inbox (no org membership required)
-- -------------------------------------------------------------------------------

-- Any authenticated user can read notifications addressed to them (user_id matches their user row), even without an active membership.
DROP POLICY IF EXISTS notifications_own_select ON public.notifications;
CREATE POLICY notifications_own_select ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.current_user_row_ids()));

-- Any authenticated user can update (e.g. mark as read) only their OWN notifications; re-assigning a notification to someone else is blocked.
DROP POLICY IF EXISTS notifications_own_update ON public.notifications;
CREATE POLICY notifications_own_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.current_user_row_ids()))
  WITH CHECK (user_id IN (SELECT public.current_user_row_ids()));

-- ===============================================================================
-- 6. Memberships — the tenant roster (sensitive: controls access itself)
-- ===============================================================================

-- Memberships are the rows that GRANT access, so they get stricter rules:
--   * read   — active members can see the roster of their own orgs
--   * insert — a user may only create a membership FOR THEMSELVES and only
--              with status 'invited' (self-service invite acceptance). An
--              'invited' row grants ZERO data access because
--              current_user_org_ids() only counts status = 'active'.
--   * update — ONLY org owners/admins can change roles or statuses
--              (e.g. activate an invited member, promote/demote).
--   * delete — org admins can remove anyone; members can remove only
--              their own row (leave the org).
-- -----------------------------------------------------------------------------

-- Active members can read the membership roster of their own organizations.
DROP POLICY IF EXISTS memberships_tenant_select ON public.memberships;
CREATE POLICY memberships_tenant_select ON public.memberships
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- A user can insert a membership only for THEMSELVES and only with status 'invited' — an invited row grants no data access until an admin activates it.
DROP POLICY IF EXISTS memberships_tenant_insert ON public.memberships;
CREATE POLICY memberships_tenant_insert ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.current_user_row_ids()) AND status = 'invited');

-- Only org owners/admins can change membership roles/status (activate an invite, promote/demote, suspend) — inside their own orgs only.
DROP POLICY IF EXISTS memberships_admin_update ON public.memberships;
CREATE POLICY memberships_admin_update ON public.memberships
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

-- Org admins can remove any member of their org; regular members can remove only their own membership (leave org).
DROP POLICY IF EXISTS memberships_tenant_delete ON public.memberships;
CREATE POLICY memberships_tenant_delete ON public.memberships
  FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id) OR user_id IN (SELECT public.current_user_row_ids()));

-- ===============================================================================
-- 7. Organizations — the tenant root
-- ===============================================================================

--   * read   — active members can read the organizations they belong to.
--   * update — only owners/admins can edit the org profile/billing fields.
--   * NO INSERT or DELETE policy for authenticated users, BY DESIGN:
--     organizations are created and deleted by the platform (service_role,
--     which bypasses RLS) or by the trusted nova_app server role during
--     signup (see organizations_app_insert in section 10). Letting end users
--     insert arbitrary organizations would let anyone mint a new tenant
--     without provisioning; deletion must stay a controlled, cascading
--     platform operation.
-- -----------------------------------------------------------------------------

-- Active members can read the organizations they belong to.
DROP POLICY IF EXISTS organizations_tenant_select ON public.organizations;
CREATE POLICY organizations_tenant_select ON public.organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.current_user_org_ids()));

-- Only org owners/admins can update organization profile/billing fields.
DROP POLICY IF EXISTS organizations_admin_update ON public.organizations;
CREATE POLICY organizations_admin_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(id))
  WITH CHECK (public.is_org_admin(id));

-- ===============================================================================
-- 8. Invoices & audit_logs — SELECT-only for end users
-- ===============================================================================

-- Financial records and the audit trail are intentionally append-only:
--   * authenticated users get a single SELECT policy (transparent billing /
--     audit visibility inside their org).
--   * There are NO insert/update/delete policies for authenticated — writes
--     are reserved to service_role (platform) and nova_app (the audited
--     Next.js API; see the *_app_* policies in section 10).
-- -----------------------------------------------------------------------------

-- -------------------------------------------------------------------------------
-- invoices — Invoices — billing history (read-only for end users)
-- -------------------------------------------------------------------------------

-- Org members can read invoices rows of their own organizations (transparency) — no end-user write policies exist for this table.
DROP POLICY IF EXISTS invoices_tenant_select ON public.invoices;
CREATE POLICY invoices_tenant_select ON public.invoices
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- -------------------------------------------------------------------------------
-- audit_logs — Audit logs — append-only trail (read-only for end users)
-- -------------------------------------------------------------------------------

-- Org members can read audit_logs rows of their own organizations (transparency) — no end-user write policies exist for this table.
DROP POLICY IF EXISTS audit_logs_tenant_select ON public.audit_logs;
CREATE POLICY audit_logs_tenant_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

-- ===============================================================================
-- 9. Users & sessions — custom auth tables
-- ===============================================================================

-- USERS: a signed-in user can read and update their own profile row.
-- Matching works both by users.id = auth.uid() (uuid ids) and by the
-- users.auth_user_id bridge (custom cuid ids) — see current_user_row_ids().
-- There is NO self-insert (signup goes through the API/nova_app) and NO
-- self-delete (account deletion is a controlled platform flow).
--
-- SESSIONS: NO policies for authenticated/anon at all. Session tokens are
-- server-side credentials — only service_role (BYPASSRLS) and nova_app (the
-- Next.js API, policies in section 10) may touch them. Table privileges for
-- authenticated are explicitly revoked in section 12.
-- -----------------------------------------------------------------------------

-- -------------------------------------------------------------------------------
-- users — self service
-- -------------------------------------------------------------------------------

-- Users can read their own profile row (matched by id or auth_user_id).
DROP POLICY IF EXISTS users_self_select ON public.users;
CREATE POLICY users_self_select ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid()::text OR auth_user_id = auth.uid());

-- Users can update only their own profile row (name, title, phone, avatar...). No self-insert, no self-delete.
DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid()::text OR auth_user_id = auth.uid())
  WITH CHECK (id = auth.uid()::text OR auth_user_id = auth.uid());

-- -------------------------------------------------------------------------------
-- sessions — nothing for end users (see note above)
-- -------------------------------------------------------------------------------

-- ===============================================================================
-- 10. STRICT MODE — the nova_app role (Next.js API / Prisma)
-- ===============================================================================

-- Defense-in-depth for the Prisma direct connection. The Next.js API:
--
--   1. connects (or SET ROLEs) as nova_app — a NON-BYPASSRLS role;
--   2. opens a transaction per request (prisma.$transaction or BEGIN/COMMIT);
--   3. pins the tenant:   SET LOCAL app.org_id = '<org-id>';
--      (SET LOCAL is pgbouncer/transaction-pooling safe: the pin evaporates
--       at COMMIT, so pooled connections can never leak tenant context);
--   4. runs its queries — every *_app_* policy below confines reads AND
--      writes to rows where org_id = current_setting('app.org_id').
--
-- If app.org_id is NOT set, current_setting(..., true) is NULL, every
-- comparison is false and the query returns nothing — fail closed.
--
-- Prisma example:
--   await prisma.$transaction(async (tx) => {
--     await tx.$executeRawUnsafe(`SELECT set_config('app.org_id', $1, true)`, orgId);
--     return tx.lead.findMany(); // only this org's leads can come back
--   });
--
-- Bootstrap exceptions (documented, deliberate):
--   * users / sessions have no org_id — the API's session layer is the gate,
--     so their app policies are USING (true) for the trusted server role.
--   * organizations_app_insert allows signup (the org does not exist yet, so
--     there is nothing to pin); reads/updates/deletes stay pinned.
--   * memberships app writes additionally allow the NULL-pin case because
--     signup creates the first membership before any org context exists.
-- -----------------------------------------------------------------------------

-- -------------------------------------------------------------------------------
-- leads — strict org pin (leads.org_id)
-- -------------------------------------------------------------------------------

-- nova_app: read only the org pinned by this transaction's SET LOCAL app.org_id.
DROP POLICY IF EXISTS leads_app_select ON public.leads;
CREATE POLICY leads_app_select ON public.leads
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: create rows only for the pinned org (unpinned inserts fail).
DROP POLICY IF EXISTS leads_app_insert ON public.leads;
CREATE POLICY leads_app_insert ON public.leads
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update rows only for the pinned org — and cannot move a row to another org (WITH CHECK re-pins the new row).
DROP POLICY IF EXISTS leads_app_update ON public.leads;
CREATE POLICY leads_app_update ON public.leads
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: delete rows only for the pinned org.
DROP POLICY IF EXISTS leads_app_delete ON public.leads;
CREATE POLICY leads_app_delete ON public.leads
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- contacts — strict org pin (contacts.org_id)
-- -------------------------------------------------------------------------------

-- nova_app: read only the org pinned by this transaction's SET LOCAL app.org_id.
DROP POLICY IF EXISTS contacts_app_select ON public.contacts;
CREATE POLICY contacts_app_select ON public.contacts
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: create rows only for the pinned org (unpinned inserts fail).
DROP POLICY IF EXISTS contacts_app_insert ON public.contacts;
CREATE POLICY contacts_app_insert ON public.contacts
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update rows only for the pinned org — and cannot move a row to another org (WITH CHECK re-pins the new row).
DROP POLICY IF EXISTS contacts_app_update ON public.contacts;
CREATE POLICY contacts_app_update ON public.contacts
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: delete rows only for the pinned org.
DROP POLICY IF EXISTS contacts_app_delete ON public.contacts;
CREATE POLICY contacts_app_delete ON public.contacts
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- accounts — strict org pin (accounts.org_id)
-- -------------------------------------------------------------------------------

-- nova_app: read only the org pinned by this transaction's SET LOCAL app.org_id.
DROP POLICY IF EXISTS accounts_app_select ON public.accounts;
CREATE POLICY accounts_app_select ON public.accounts
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: create rows only for the pinned org (unpinned inserts fail).
DROP POLICY IF EXISTS accounts_app_insert ON public.accounts;
CREATE POLICY accounts_app_insert ON public.accounts
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update rows only for the pinned org — and cannot move a row to another org (WITH CHECK re-pins the new row).
DROP POLICY IF EXISTS accounts_app_update ON public.accounts;
CREATE POLICY accounts_app_update ON public.accounts
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: delete rows only for the pinned org.
DROP POLICY IF EXISTS accounts_app_delete ON public.accounts;
CREATE POLICY accounts_app_delete ON public.accounts
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- deals — strict org pin (deals.org_id)
-- -------------------------------------------------------------------------------

-- nova_app: read only the org pinned by this transaction's SET LOCAL app.org_id.
DROP POLICY IF EXISTS deals_app_select ON public.deals;
CREATE POLICY deals_app_select ON public.deals
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: create rows only for the pinned org (unpinned inserts fail).
DROP POLICY IF EXISTS deals_app_insert ON public.deals;
CREATE POLICY deals_app_insert ON public.deals
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update rows only for the pinned org — and cannot move a row to another org (WITH CHECK re-pins the new row).
DROP POLICY IF EXISTS deals_app_update ON public.deals;
CREATE POLICY deals_app_update ON public.deals
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: delete rows only for the pinned org.
DROP POLICY IF EXISTS deals_app_delete ON public.deals;
CREATE POLICY deals_app_delete ON public.deals
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- tasks — strict org pin (tasks.org_id)
-- -------------------------------------------------------------------------------

-- nova_app: read only the org pinned by this transaction's SET LOCAL app.org_id.
DROP POLICY IF EXISTS tasks_app_select ON public.tasks;
CREATE POLICY tasks_app_select ON public.tasks
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: create rows only for the pinned org (unpinned inserts fail).
DROP POLICY IF EXISTS tasks_app_insert ON public.tasks;
CREATE POLICY tasks_app_insert ON public.tasks
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update rows only for the pinned org — and cannot move a row to another org (WITH CHECK re-pins the new row).
DROP POLICY IF EXISTS tasks_app_update ON public.tasks;
CREATE POLICY tasks_app_update ON public.tasks
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: delete rows only for the pinned org.
DROP POLICY IF EXISTS tasks_app_delete ON public.tasks;
CREATE POLICY tasks_app_delete ON public.tasks
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- activities — strict org pin (activities.org_id)
-- -------------------------------------------------------------------------------

-- nova_app: read only the org pinned by this transaction's SET LOCAL app.org_id.
DROP POLICY IF EXISTS activities_app_select ON public.activities;
CREATE POLICY activities_app_select ON public.activities
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: create rows only for the pinned org (unpinned inserts fail).
DROP POLICY IF EXISTS activities_app_insert ON public.activities;
CREATE POLICY activities_app_insert ON public.activities
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update rows only for the pinned org — and cannot move a row to another org (WITH CHECK re-pins the new row).
DROP POLICY IF EXISTS activities_app_update ON public.activities;
CREATE POLICY activities_app_update ON public.activities
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: delete rows only for the pinned org.
DROP POLICY IF EXISTS activities_app_delete ON public.activities;
CREATE POLICY activities_app_delete ON public.activities
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- products — strict org pin (products.org_id)
-- -------------------------------------------------------------------------------

-- nova_app: read only the org pinned by this transaction's SET LOCAL app.org_id.
DROP POLICY IF EXISTS products_app_select ON public.products;
CREATE POLICY products_app_select ON public.products
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: create rows only for the pinned org (unpinned inserts fail).
DROP POLICY IF EXISTS products_app_insert ON public.products;
CREATE POLICY products_app_insert ON public.products
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update rows only for the pinned org — and cannot move a row to another org (WITH CHECK re-pins the new row).
DROP POLICY IF EXISTS products_app_update ON public.products;
CREATE POLICY products_app_update ON public.products
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: delete rows only for the pinned org.
DROP POLICY IF EXISTS products_app_delete ON public.products;
CREATE POLICY products_app_delete ON public.products
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- workflows — strict org pin (workflows.org_id)
-- -------------------------------------------------------------------------------

-- nova_app: read only the org pinned by this transaction's SET LOCAL app.org_id.
DROP POLICY IF EXISTS workflows_app_select ON public.workflows;
CREATE POLICY workflows_app_select ON public.workflows
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: create rows only for the pinned org (unpinned inserts fail).
DROP POLICY IF EXISTS workflows_app_insert ON public.workflows;
CREATE POLICY workflows_app_insert ON public.workflows
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update rows only for the pinned org — and cannot move a row to another org (WITH CHECK re-pins the new row).
DROP POLICY IF EXISTS workflows_app_update ON public.workflows;
CREATE POLICY workflows_app_update ON public.workflows
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: delete rows only for the pinned org.
DROP POLICY IF EXISTS workflows_app_delete ON public.workflows;
CREATE POLICY workflows_app_delete ON public.workflows
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- email_templates — strict org pin (email_templates.org_id)
-- -------------------------------------------------------------------------------

-- nova_app: read only the org pinned by this transaction's SET LOCAL app.org_id.
DROP POLICY IF EXISTS email_templates_app_select ON public.email_templates;
CREATE POLICY email_templates_app_select ON public.email_templates
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: create rows only for the pinned org (unpinned inserts fail).
DROP POLICY IF EXISTS email_templates_app_insert ON public.email_templates;
CREATE POLICY email_templates_app_insert ON public.email_templates
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update rows only for the pinned org — and cannot move a row to another org (WITH CHECK re-pins the new row).
DROP POLICY IF EXISTS email_templates_app_update ON public.email_templates;
CREATE POLICY email_templates_app_update ON public.email_templates
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: delete rows only for the pinned org.
DROP POLICY IF EXISTS email_templates_app_delete ON public.email_templates;
CREATE POLICY email_templates_app_delete ON public.email_templates
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- campaigns — strict org pin (campaigns.org_id)
-- -------------------------------------------------------------------------------

-- nova_app: read only the org pinned by this transaction's SET LOCAL app.org_id.
DROP POLICY IF EXISTS campaigns_app_select ON public.campaigns;
CREATE POLICY campaigns_app_select ON public.campaigns
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: create rows only for the pinned org (unpinned inserts fail).
DROP POLICY IF EXISTS campaigns_app_insert ON public.campaigns;
CREATE POLICY campaigns_app_insert ON public.campaigns
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update rows only for the pinned org — and cannot move a row to another org (WITH CHECK re-pins the new row).
DROP POLICY IF EXISTS campaigns_app_update ON public.campaigns;
CREATE POLICY campaigns_app_update ON public.campaigns
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: delete rows only for the pinned org.
DROP POLICY IF EXISTS campaigns_app_delete ON public.campaigns;
CREATE POLICY campaigns_app_delete ON public.campaigns
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- integrations — strict org pin (integrations.org_id)
-- -------------------------------------------------------------------------------

-- nova_app: read only the org pinned by this transaction's SET LOCAL app.org_id.
DROP POLICY IF EXISTS integrations_app_select ON public.integrations;
CREATE POLICY integrations_app_select ON public.integrations
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: create rows only for the pinned org (unpinned inserts fail).
DROP POLICY IF EXISTS integrations_app_insert ON public.integrations;
CREATE POLICY integrations_app_insert ON public.integrations
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update rows only for the pinned org — and cannot move a row to another org (WITH CHECK re-pins the new row).
DROP POLICY IF EXISTS integrations_app_update ON public.integrations;
CREATE POLICY integrations_app_update ON public.integrations
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: delete rows only for the pinned org.
DROP POLICY IF EXISTS integrations_app_delete ON public.integrations;
CREATE POLICY integrations_app_delete ON public.integrations
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- notifications — strict org pin (notifications.org_id)
-- -------------------------------------------------------------------------------

-- nova_app: read only the org pinned by this transaction's SET LOCAL app.org_id.
DROP POLICY IF EXISTS notifications_app_select ON public.notifications;
CREATE POLICY notifications_app_select ON public.notifications
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: create rows only for the pinned org (unpinned inserts fail).
DROP POLICY IF EXISTS notifications_app_insert ON public.notifications;
CREATE POLICY notifications_app_insert ON public.notifications
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update rows only for the pinned org — and cannot move a row to another org (WITH CHECK re-pins the new row).
DROP POLICY IF EXISTS notifications_app_update ON public.notifications;
CREATE POLICY notifications_app_update ON public.notifications
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: delete rows only for the pinned org.
DROP POLICY IF EXISTS notifications_app_delete ON public.notifications;
CREATE POLICY notifications_app_delete ON public.notifications
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- memberships — strict org pin + signup bootstrap
-- -------------------------------------------------------------------------------

-- nova_app: roster lookups are user-scoped, not org-scoped — the API filters by user_id from the session; writes below stay org-pinned.
DROP POLICY IF EXISTS memberships_app_select ON public.memberships;
CREATE POLICY memberships_app_select ON public.memberships
  FOR SELECT TO nova_app
  USING (true);

-- nova_app: create a membership only for the pinned org, OR during signup when no org is pinned yet (NULL pin = bootstrap only).
DROP POLICY IF EXISTS memberships_app_insert ON public.memberships;
CREATE POLICY memberships_app_insert ON public.memberships
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true)
     OR current_setting('app.org_id', true) IS NULL);

-- nova_app: update memberships only for the pinned org (or during signup bootstrap); the updated row must stay in a pinned org.
DROP POLICY IF EXISTS memberships_app_update ON public.memberships;
CREATE POLICY memberships_app_update ON public.memberships
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true)
     OR current_setting('app.org_id', true) IS NULL)
  WITH CHECK (org_id = current_setting('app.org_id', true)
     OR current_setting('app.org_id', true) IS NULL);

-- nova_app: delete memberships only for the pinned org (or during signup bootstrap cleanup).
DROP POLICY IF EXISTS memberships_app_delete ON public.memberships;
CREATE POLICY memberships_app_delete ON public.memberships
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true)
     OR current_setting('app.org_id', true) IS NULL);

-- -------------------------------------------------------------------------------
-- organizations — strict org pin (id = the org id)
-- -------------------------------------------------------------------------------

-- nova_app: read only the pinned org.
DROP POLICY IF EXISTS organizations_app_select ON public.organizations;
CREATE POLICY organizations_app_select ON public.organizations
  FOR SELECT TO nova_app
  USING (id = current_setting('app.org_id', true));

-- nova_app: create an organization — allowed unpinned because signup must create the org before any pin can exist (platform provisioning).
DROP POLICY IF EXISTS organizations_app_insert ON public.organizations;
CREATE POLICY organizations_app_insert ON public.organizations
  FOR INSERT TO nova_app
  WITH CHECK (true);

-- nova_app: update only the pinned org; cannot reparent an org.
DROP POLICY IF EXISTS organizations_app_update ON public.organizations;
CREATE POLICY organizations_app_update ON public.organizations
  FOR UPDATE TO nova_app
  USING (id = current_setting('app.org_id', true))
  WITH CHECK (id = current_setting('app.org_id', true));

-- nova_app: delete only the pinned org (cascades the whole tenant).
DROP POLICY IF EXISTS organizations_app_delete ON public.organizations;
CREATE POLICY organizations_app_delete ON public.organizations
  FOR DELETE TO nova_app
  USING (id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- invoices — strict org pin, no deletes (void instead)
-- -------------------------------------------------------------------------------

-- nova_app: read invoices only for the pinned org.
DROP POLICY IF EXISTS invoices_app_select ON public.invoices;
CREATE POLICY invoices_app_select ON public.invoices
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: create invoices only for the pinned org.
DROP POLICY IF EXISTS invoices_app_insert ON public.invoices;
CREATE POLICY invoices_app_insert ON public.invoices
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update invoices (e.g. open -> paid) only for the pinned org; deleting financial records is intentionally not allowed.
DROP POLICY IF EXISTS invoices_app_update ON public.invoices;
CREATE POLICY invoices_app_update ON public.invoices
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- audit_logs — strict org pin, append-only
-- -------------------------------------------------------------------------------

-- nova_app: read audit trail only for the pinned org.
DROP POLICY IF EXISTS audit_logs_app_select ON public.audit_logs;
CREATE POLICY audit_logs_app_select ON public.audit_logs
  FOR SELECT TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- nova_app: append audit entries only for the pinned org; UPDATE and DELETE do not exist on purpose — the trail is immutable.
DROP POLICY IF EXISTS audit_logs_app_insert ON public.audit_logs;
CREATE POLICY audit_logs_app_insert ON public.audit_logs
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- users — trusted server access (identity layer)
-- -------------------------------------------------------------------------------

-- nova_app: user lookups for login/session validation. The users table has no org_id — the API's session layer is the gate here.
DROP POLICY IF EXISTS users_app_select ON public.users;
CREATE POLICY users_app_select ON public.users
  FOR SELECT TO nova_app
  USING (true);

-- nova_app: create users at signup.
DROP POLICY IF EXISTS users_app_insert ON public.users;
CREATE POLICY users_app_insert ON public.users
  FOR INSERT TO nova_app
  WITH CHECK (true);

-- nova_app: update user profiles (profile edits, password changes).
DROP POLICY IF EXISTS users_app_update ON public.users;
CREATE POLICY users_app_update ON public.users
  FOR UPDATE TO nova_app
  USING (true)
  WITH CHECK (true);

-- nova_app: delete users (controlled account-deletion flows).
DROP POLICY IF EXISTS users_app_delete ON public.users;
CREATE POLICY users_app_delete ON public.users
  FOR DELETE TO nova_app
  USING (true);

-- -------------------------------------------------------------------------------
-- sessions — trusted server access (custom auth)
-- -------------------------------------------------------------------------------

-- nova_app: validate session tokens at request time. The token is a high-entropy secret and is itself the credential.
DROP POLICY IF EXISTS sessions_app_select ON public.sessions;
CREATE POLICY sessions_app_select ON public.sessions
  FOR SELECT TO nova_app
  USING (true);

-- nova_app: create sessions at login.
DROP POLICY IF EXISTS sessions_app_insert ON public.sessions;
CREATE POLICY sessions_app_insert ON public.sessions
  FOR INSERT TO nova_app
  WITH CHECK (true);

-- nova_app: delete sessions at logout/expiry. Sessions are immutable rows — 'refresh' means delete + insert, hence no UPDATE policy.
DROP POLICY IF EXISTS sessions_app_delete ON public.sessions;
CREATE POLICY sessions_app_delete ON public.sessions
  FOR DELETE TO nova_app
  USING (true);

-- ===============================================================================
-- 11. Owner escape hatch — the postgres (table owner) role
-- ===============================================================================

-- We FORCE ROW LEVEL SECURITY (section 3), which subjects even the table
-- owner to policies. RLS can never actually constrain the owner (it can
-- ALTER/DROP policies at will), so we re-grant full access EXPLICITLY.
-- This is required for two things to work:
--   1. the SECURITY DEFINER helpers (section 1) must read memberships/users
--      as the owner without recursing into the tenant policies;
--   2. operational access — Dashboard SQL Editor, `supabase db dump`,
--      support queries — keeps working as expected.
-- The policies are scoped TO postgres so they never apply to authenticated,
-- nova_app or anon.
-- -----------------------------------------------------------------------------

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS users_owner_admin ON public.users;
CREATE POLICY users_owner_admin ON public.users
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS sessions_owner_admin ON public.sessions;
CREATE POLICY sessions_owner_admin ON public.sessions
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS organizations_owner_admin ON public.organizations;
CREATE POLICY organizations_owner_admin ON public.organizations
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS memberships_owner_admin ON public.memberships;
CREATE POLICY memberships_owner_admin ON public.memberships
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS leads_owner_admin ON public.leads;
CREATE POLICY leads_owner_admin ON public.leads
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS contacts_owner_admin ON public.contacts;
CREATE POLICY contacts_owner_admin ON public.contacts
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS accounts_owner_admin ON public.accounts;
CREATE POLICY accounts_owner_admin ON public.accounts
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS deals_owner_admin ON public.deals;
CREATE POLICY deals_owner_admin ON public.deals
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS tasks_owner_admin ON public.tasks;
CREATE POLICY tasks_owner_admin ON public.tasks
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS activities_owner_admin ON public.activities;
CREATE POLICY activities_owner_admin ON public.activities
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS products_owner_admin ON public.products;
CREATE POLICY products_owner_admin ON public.products
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS workflows_owner_admin ON public.workflows;
CREATE POLICY workflows_owner_admin ON public.workflows
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS email_templates_owner_admin ON public.email_templates;
CREATE POLICY email_templates_owner_admin ON public.email_templates
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS campaigns_owner_admin ON public.campaigns;
CREATE POLICY campaigns_owner_admin ON public.campaigns
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS notifications_owner_admin ON public.notifications;
CREATE POLICY notifications_owner_admin ON public.notifications
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS integrations_owner_admin ON public.integrations;
CREATE POLICY integrations_owner_admin ON public.integrations
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS invoices_owner_admin ON public.invoices;
CREATE POLICY invoices_owner_admin ON public.invoices
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS audit_logs_owner_admin ON public.audit_logs;
CREATE POLICY audit_logs_owner_admin ON public.audit_logs
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 12. Grants & revokes
-- -----------------------------------------------------------------------------
-- Layered privileges:
--   * anon          → NOTHING on tables (revoked below). The anon key can
--                     still call PostgREST, but every table request fails.
--   * authenticated → table-level CRUD grants; RLS reduces this to
--                     tenant-scoped rows (see policies above).
--   * nova_app      → table-level CRUD grants; RLS reduces this to the
--                     org pinned via app.org_id.
--   * sessions      → additionally revoked from authenticated: custom-auth
--                     session tokens are server-side only.
--   * service_role  → already has full grants + BYPASSRLS from Supabase.
--   * Helper functions: execute for authenticated + nova_app only.
--
-- NOTE (future tables): the ALTER DEFAULT PRIVILEGES statements extend the
-- same grants to tables created later by the postgres role. If you ever add
-- another server-only table (like sessions), remember to REVOKE it from
-- authenticated explicitly.
-- -----------------------------------------------------------------------------

-- Schema access
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO nova_app;

-- Table-level grants (RLS is the row-level restriction)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nova_app;

-- Lock-outs
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON public.sessions FROM authenticated;

-- Future tables (created by postgres) inherit the same posture
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nova_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;

-- Helper functions: only the two app roles may call them
REVOKE ALL ON FUNCTION public.current_user_row_ids FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_org_ids FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_member(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_admin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_owner(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_row_ids TO authenticated, nova_app;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids TO authenticated, nova_app;
GRANT EXECUTE ON FUNCTION public.is_org_member(text) TO authenticated, nova_app;
GRANT EXECUTE ON FUNCTION public.is_org_admin(text) TO authenticated, nova_app;
GRANT EXECUTE ON FUNCTION public.is_org_owner(text) TO authenticated, nova_app;

-- (public.set_updated_at needs no grant juggling: trigger functions can only
--  be executed by the engine when the trigger fires, never called directly.)

-- =============================================================================
-- 0002 complete: 18 tables, RLS ENABLED + FORCED everywhere, role-scoped
-- policies (tenant / own / admin / self / app / owner). Verify with
-- 0003_verification.sql.
-- =============================================================================
