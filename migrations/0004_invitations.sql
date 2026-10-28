-- =============================================================================
-- Nova CRM — 0004_invitations.sql
-- The `invitations` table + Row Level Security (email invitation flow)
-- =============================================================================
--
-- Backs the email-invitation system added in task 6-b:
--   * an admin creates a PENDING invitation for an email address with a
--     unique 64-hex-char capability token, valid for 7 days;
--   * the invitee opens {APP_URL}/?invite=<token> — the public "peek"
--     endpoint (GET /api/invitations?token=...) shows org/inviter/role
--     without requiring an account;
--   * they sign up or sign in with that exact email and accept
--     (POST /api/invitations/accept), which creates their ACTIVE membership;
--   * admins can re-send (new token + extended expiry) or revoke pending
--     invitations.
--
-- Mirrors prisma/schema.prisma (Invitation model) 1:1:
--   * text PK with the gen_random_uuid()::text fallback (app sends cuids);
--   * org_id → organizations ON DELETE CASCADE, invited_by_id → users
--     ON DELETE SET NULL (the exact FK behaviours of the Prisma schema);
--   * role kept as text (open catalog, mirrors the Prisma String field);
--   * status text with a CHECK constraint (pending | accepted | revoked);
--   * token UNIQUE — backed by an index, doubles as the lookup key;
--   * updated_at maintained by the existing public.set_updated_at() trigger.
--
-- RLS follows the 0002_rls.sql model exactly:
--   * every policy is role-targeted (TO authenticated / nova_app / postgres)
--     so the SECURITY DEFINER helpers never recurse;
--   * authenticated users may SELECT invitations of orgs where they are an
--     active member (is_org_member) OR invitations addressed to their own
--     email address (current_user_emails — a new helper in this file), so a
--     user can see pending invitations for themselves BEFORE any membership
--     row exists;
--   * nova_app (the Next.js API / Prisma role) may read by token — the token
--     is a 64-hex capability credential, the same trust model as sessions
--     (see sessions_app_* in 0002) — while INSERT/UPDATE/DELETE are strictly
--     pinned to the transaction's app.org_id (fail-closed);
--   * the owner gets the standard invitations_owner_admin escape hatch;
--   * NO anon/PUBLIC policies — anon has no privileges on this table.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DROP TRIGGER IF EXISTS + CREATE, DROP POLICY IF EXISTS + CREATE POLICY.
--
-- Apply AFTER 0001_init.sql + 0002_rls.sql (+ 0003_verification.sql),
-- as the postgres role (Supabase SQL Editor or psql).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Preflight — this file builds on 0001 (schema/trigger fn) + 0002 (helpers,
--    nova_app role). Abort early with a clear message if they are missing.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL OR to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Core tables missing — run 0001_init.sql before 0004_invitations.sql.';
  END IF;
  IF to_regprocedure('public.set_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'Function public.set_updated_at() not found — run 0001_init.sql before 0004_invitations.sql.';
  END IF;
  IF to_regprocedure('public.current_user_row_ids()') IS NULL
     OR to_regprocedure('public.is_org_member(text)') IS NULL THEN
    RAISE EXCEPTION 'RLS helper functions not found — run 0002_rls.sql before 0004_invitations.sql.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nova_app') THEN
    RAISE EXCEPTION 'Role "nova_app" not found — run 0002_rls.sql before 0004_invitations.sql.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
-- Prisma model: Invitation (email invitations with token/status/expiry)
CREATE TABLE IF NOT EXISTS public.invitations (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text, -- app generates cuids; uuid fallback for raw SQL
  org_id        text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  email         text NOT NULL,                                    -- invitee email, stored lowercase by the API
  role          text NOT NULL DEFAULT 'member',                   -- admin | manager | member (validated by the API's zod schema)
  token         text NOT NULL,                                    -- 64-hex capability token; the secret that authorizes the invite link
  status        text NOT NULL DEFAULT 'pending',
  invited_by_id text REFERENCES public.users (id) ON DELETE SET NULL, -- the admin who sent (or last re-sent) the invitation
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_token_key UNIQUE (token),
  CONSTRAINT invitations_status_check CHECK (status IN ('pending', 'accepted', 'revoked'))
);

COMMENT ON COLUMN public.invitations.token IS
  'High-entropy capability token (crypto random, 64 hex chars) — knowing it authorizes viewing/accepting the invitation, the same trust model as sessions.token.';
COMMENT ON COLUMN public.invitations.email IS
  'Invitee email address (lowercase). Acceptance requires a session whose email matches this value.';

-- Prisma @@index([orgId]) — org-scoped history/roster lookups.
CREATE INDEX IF NOT EXISTS invitations_org_id_idx ON public.invitations (org_id);
-- Prisma @@index([email, status]) — "pending invitations for this email" (auth/me banner, signup auto-accept).
CREATE INDEX IF NOT EXISTS invitations_email_status_idx ON public.invitations (email, status);

-- -----------------------------------------------------------------------------
-- 2. updated_at maintenance (same trigger function as 0001)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_updated_at ON public.invitations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Helper function — current_user_emails()
-- -----------------------------------------------------------------------------
-- Lowercased emails of the caller, resolved through current_user_row_ids()
-- (works with both uuid ids and the auth_user_id bridge). Used by
-- invitations_tenant_select so invited users can see their own invitations
-- BEFORE a membership row exists. Same shape as the 0002 helpers:
-- SECURITY DEFINER + STABLE + pinned search_path.
CREATE OR REPLACE FUNCTION public.current_user_emails()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(u.email)
  FROM public.users AS u
  WHERE u.id IN (SELECT public.current_user_row_ids());
$$;

-- -----------------------------------------------------------------------------
-- 4. Enable + FORCE Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE  ROW LEVEL SECURITY;

-- =============================================================================
-- 5. Policies
-- ===============================================================================

-- -------------------------------------------------------------------------------
-- authenticated — read-only visibility (org roster + own invitations)
-- -------------------------------------------------------------------------------

-- Active members can read the invitation history of their own orgs; users can
-- also read invitations addressed to their own email even before joining (that
-- is the entire point of an invitation). NO write policies exist for
-- authenticated — invitations are created/mutated only by admins through the
-- Next.js API (nova_app policies below).
DROP POLICY IF EXISTS invitations_tenant_select ON public.invitations;
CREATE POLICY invitations_tenant_select ON public.invitations
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id)
     OR lower(email) IN (SELECT public.current_user_emails()));

-- -------------------------------------------------------------------------------
-- nova_app — the Next.js API / Prisma role (strict org pin, fail-closed)
-- -------------------------------------------------------------------------------

-- nova_app resolves invitations BY TOKEN: the public peek endpoint has no
-- session, and accept/decline run with the caller pinned to THEIR current org
-- while the invitation may belong to a different org. The 64-hex token is a
-- high-entropy capability credential — same trust model as sessions_app_select.
DROP POLICY IF EXISTS invitations_app_select ON public.invitations;
CREATE POLICY invitations_app_select ON public.invitations
  FOR SELECT TO nova_app
  USING (true);

-- nova_app: create invitations only for the pinned org (an admin inviting from
-- inside their workspace). Unpinned inserts fail closed.
DROP POLICY IF EXISTS invitations_app_insert ON public.invitations;
CREATE POLICY invitations_app_insert ON public.invitations
  FOR INSERT TO nova_app
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: update rows only for the pinned org. The API re-pins
-- app.org_id to the INVITATION's org before accept/resend/revoke mutations
-- (set_config('app.org_id', invitations.org_id, true) inside the transaction),
-- keeping writes fail-closed to exactly one known org.
DROP POLICY IF EXISTS invitations_app_update ON public.invitations;
CREATE POLICY invitations_app_update ON public.invitations
  FOR UPDATE TO nova_app
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

-- nova_app: delete rows only for the pinned org (explicit cleanup; org
-- deletion cascades through the FK without needing this policy).
DROP POLICY IF EXISTS invitations_app_delete ON public.invitations;
CREATE POLICY invitations_app_delete ON public.invitations
  FOR DELETE TO nova_app
  USING (org_id = current_setting('app.org_id', true));

-- -------------------------------------------------------------------------------
-- owner escape hatch — the postgres (table owner) role
-- -------------------------------------------------------------------------------

-- Table owner (postgres): full access — SQL Editor/ops + recursion-free helpers. Never applies to anon/authenticated/nova_app.
DROP POLICY IF EXISTS invitations_owner_admin ON public.invitations;
CREATE POLICY invitations_owner_admin ON public.invitations
  FOR ALL TO postgres
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 6. Grants & revokes (mirrors 0002 section 12)
-- -----------------------------------------------------------------------------
-- Table-level CRUD grants; the policies above are the row-level restriction.
-- anon gets NOTHING on this table. current_user_emails() is executable by the
-- two app roles only (it reads users.email).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO nova_app;
REVOKE ALL ON public.invitations FROM anon;

REVOKE ALL ON FUNCTION public.current_user_emails FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_emails TO authenticated, nova_app;

-- -----------------------------------------------------------------------------
-- 7. Verification (0003-style DO block — RAISE EXCEPTION on failure)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_policies text;
  v_count    int;
  v_anon     int;
BEGIN
  -- RLS enabled + forced
  IF to_regclass('public.invitations') IS NULL THEN
    RAISE EXCEPTION '0004 CHECK FAILED — public.invitations was not created.';
  END IF;
  IF NOT (SELECT c.relrowsecurity FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'invitations') THEN
    RAISE EXCEPTION '0004 CHECK FAILED — RLS is not ENABLED on public.invitations.';
  END IF;
  IF NOT (SELECT c.relforcerowsecurity FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'invitations') THEN
    RAISE EXCEPTION '0004 CHECK FAILED — RLS is not FORCED on public.invitations.';
  END IF;

  -- set_updated_at trigger present
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
    JOIN pg_class c     ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'invitations'
      AND tg.tgname = 'set_updated_at' AND NOT tg.tgisinternal
  ) THEN
    RAISE EXCEPTION '0004 CHECK FAILED — set_updated_at trigger missing on public.invitations.';
  END IF;

  -- Exact policy inventory: 6 policies, no extras
  SELECT string_agg(p.polname, ',' ORDER BY p.polname), count(*)
  INTO v_policies, v_count
  FROM pg_policy p
  JOIN pg_class c     ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'invitations';

  IF v_count <> 6 OR v_policies IS DISTINCT FROM
     'invitations_app_delete,invitations_app_insert,invitations_app_select,invitations_app_update,invitations_owner_admin,invitations_tenant_select' THEN
    RAISE EXCEPTION '0004 CHECK FAILED — unexpected policy inventory on public.invitations (%, found: %)', v_count, coalesce(v_policies, '<none>');
  END IF;

  -- No anon/PUBLIC policies (same pg_policies pattern as 0003 CHECK 6 —
  -- pg_policy.polroles stores PUBLIC as oid 0, so cast-free view is simpler)
  SELECT count(*) INTO v_anon
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'invitations'
    AND ('anon' = ANY (p.roles) OR 'public' = ANY (p.roles));
  IF v_anon <> 0 THEN
    RAISE EXCEPTION '0004 CHECK FAILED — anon/PUBLIC policies must not exist on public.invitations.';
  END IF;

  RAISE NOTICE '0004 OK — invitations table + RLS verified (6 policies, RLS ENABLED + FORCED, no anon access).';
END $$;

-- =============================================================================
-- 0004 complete. Total policy count is now 146 + 6 = 152 across 19 tables.
-- 0003_verification.sql is invitations-aware: re-running it after this file
-- verifies all 152 policies (base 146 + the 6 invitation policies above).
-- =============================================================================
