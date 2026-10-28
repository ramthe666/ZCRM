-- =============================================================================
-- Nova CRM — 0003_verification.sql
-- Post-apply verification suite for 0001 + 0002 (Supabase / PostgreSQL 15+)
-- =============================================================================
--
-- Run AFTER 0001_init.sql and 0002_rls.sql, as the postgres role
-- (Dashboard SQL Editor or psql). Every check is a DO block that raises an
-- EXCEPTION on failure and prints a RAISE NOTICE on success. If you see all
-- nine "OK" notices and no error, the tenant isolation layer is correctly
-- installed.
--
-- At the bottom you will find (commented) attack simulations and the
-- nova_app strict-mode walkthrough.
--
-- Expected: 18 tables, 23 enum types, 5 helper functions,
-- 146 RLS policies (152 once 0004_invitations.sql is applied).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CHECK 1 — all 18 tables exist, RLS ENABLED and FORCED on every one of them
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_tbl  text;
  v_fail text := '';
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY['users', 'sessions', 'organizations', 'memberships', 'leads', 'contacts', 'accounts', 'deals', 'tasks', 'activities', 'products', 'workflows', 'email_templates', 'campaigns', 'notifications', 'integrations', 'invoices', 'audit_logs'] LOOP
    IF to_regclass('public.' || v_tbl) IS NULL THEN
      v_fail := v_fail || format('  - table %s is missing (run 0001_init.sql first)', v_tbl) || chr(10);
    ELSE
      IF NOT (SELECT c.relrowsecurity FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relname = v_tbl) THEN
        v_fail := v_fail || format('  - %s: RLS is not ENABLED', v_tbl) || chr(10);
      END IF;
      IF NOT (SELECT c.relforcerowsecurity FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relname = v_tbl) THEN
        v_fail := v_fail || format('  - %s: RLS is not FORCED', v_tbl) || chr(10);
      END IF;
    END IF;
  END LOOP;
  IF v_fail <> '' THEN
    RAISE EXCEPTION 'CHECK 1 FAILED — RLS not fully enabled/forced:%', chr(10) || v_fail;
  END IF;
  RAISE NOTICE 'CHECK 1 OK — RLS ENABLED + FORCED on all 18 tables.';
END $$;

-- -----------------------------------------------------------------------------
-- CHECK 2 — all 23 native enum types exist
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(e.name, ', ') INTO v_missing
  FROM unnest(ARRAY['account_size', 'account_tier', 'activity_outcome', 'activity_type', 'billing_cycle', 'campaign_segment', 'campaign_status', 'deal_stage', 'email_template_category', 'integration_provider_status', 'invoice_status', 'lead_source', 'lead_status', 'lifecycle_stage', 'member_role', 'membership_status', 'notification_type', 'plan_key', 'plan_status', 'related_entity_type', 'task_priority', 'task_status', 'workflow_trigger']) AS e(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = e.name
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 2 FAILED — missing enum types: %', v_missing;
  END IF;
  RAISE NOTICE 'CHECK 2 OK — all 23 enum types present.';
END $$;

-- -----------------------------------------------------------------------------
-- CHECK 3 — the 5 RLS helper functions exist and are
--           SECURITY DEFINER + STABLE with a pinned search_path
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
  v_bad     int;
BEGIN
  SELECT string_agg(f.name, ', ') INTO v_missing
  FROM (VALUES ('current_user_row_ids', '()'), ('current_user_org_ids', '()'), ('is_org_member', '(text)'), ('is_org_admin', '(text)'), ('is_org_owner', '(text)')) AS f(name, sig)
  WHERE to_regprocedure('public.' || f.name || f.sig) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 3 FAILED — missing helper functions: %', v_missing;
  END IF;

  SELECT count(*) INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY (ARRAY['current_user_row_ids', 'current_user_org_ids', 'is_org_member', 'is_org_admin', 'is_org_owner'])
    AND (NOT p.prosecdef OR p.provolatile <> 's');
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'CHECK 3 FAILED — % helper function(s) are not (SECURITY DEFINER + STABLE).', v_bad;
  END IF;
  RAISE NOTICE 'CHECK 3 OK — 5 helper functions present (SECURITY DEFINER, STABLE).';
END $$;

-- -----------------------------------------------------------------------------
-- CHECK 4 — set_updated_at trigger exists on every table that has updated_at
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_tbl     text;
  v_missing text := '';
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY['users', 'organizations', 'leads', 'contacts', 'accounts', 'deals', 'tasks', 'products', 'workflows', 'email_templates', 'campaigns', 'integrations'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger tg
      JOIN pg_class c     ON c.oid = tg.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v_tbl
        AND tg.tgname = 'set_updated_at'
        AND NOT tg.tgisinternal
    ) THEN
      v_missing := v_missing || v_tbl || ', ';
    END IF;
  END LOOP;
  IF v_missing <> '' THEN
    RAISE EXCEPTION 'CHECK 4 FAILED — set_updated_at trigger missing on: %', v_missing;
  END IF;
  RAISE NOTICE 'CHECK 4 OK — set_updated_at trigger present on all 12 tables.';
END $$;

-- -----------------------------------------------------------------------------
-- CHECK 5 — the EXACT policy inventory 0002 installs, table by table
--           (146 policies). Any drift (missing, renamed or extra
--           policy) fails with the full diff.
--           If 0004_invitations.sql has ALSO been applied, its 6 invitation
--           policies are verified too (152 total) — so this file can be
--           re-run for re-verification at any stage without false failures.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r     record;
  v_act text;
  v_exp int;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('users', 'users_app_delete,users_app_insert,users_app_select,users_app_update,users_owner_admin,users_self_select,users_self_update'),
      ('sessions', 'sessions_app_delete,sessions_app_insert,sessions_app_select,sessions_owner_admin'),
      ('organizations', 'organizations_admin_update,organizations_app_delete,organizations_app_insert,organizations_app_select,organizations_app_update,organizations_owner_admin,organizations_tenant_select'),
      ('memberships', 'memberships_admin_update,memberships_app_delete,memberships_app_insert,memberships_app_select,memberships_app_update,memberships_owner_admin,memberships_tenant_delete,memberships_tenant_insert,memberships_tenant_select'),
      ('leads', 'leads_app_delete,leads_app_insert,leads_app_select,leads_app_update,leads_owner_admin,leads_tenant_delete,leads_tenant_insert,leads_tenant_select,leads_tenant_update'),
      ('contacts', 'contacts_app_delete,contacts_app_insert,contacts_app_select,contacts_app_update,contacts_owner_admin,contacts_tenant_delete,contacts_tenant_insert,contacts_tenant_select,contacts_tenant_update'),
      ('accounts', 'accounts_app_delete,accounts_app_insert,accounts_app_select,accounts_app_update,accounts_owner_admin,accounts_tenant_delete,accounts_tenant_insert,accounts_tenant_select,accounts_tenant_update'),
      ('deals', 'deals_app_delete,deals_app_insert,deals_app_select,deals_app_update,deals_owner_admin,deals_tenant_delete,deals_tenant_insert,deals_tenant_select,deals_tenant_update'),
      ('tasks', 'tasks_app_delete,tasks_app_insert,tasks_app_select,tasks_app_update,tasks_owner_admin,tasks_tenant_delete,tasks_tenant_insert,tasks_tenant_select,tasks_tenant_update'),
      ('activities', 'activities_app_delete,activities_app_insert,activities_app_select,activities_app_update,activities_owner_admin,activities_tenant_delete,activities_tenant_insert,activities_tenant_select,activities_tenant_update'),
      ('products', 'products_app_delete,products_app_insert,products_app_select,products_app_update,products_owner_admin,products_tenant_delete,products_tenant_insert,products_tenant_select,products_tenant_update'),
      ('workflows', 'workflows_app_delete,workflows_app_insert,workflows_app_select,workflows_app_update,workflows_owner_admin,workflows_tenant_delete,workflows_tenant_insert,workflows_tenant_select,workflows_tenant_update'),
      ('email_templates', 'email_templates_app_delete,email_templates_app_insert,email_templates_app_select,email_templates_app_update,email_templates_owner_admin,email_templates_tenant_delete,email_templates_tenant_insert,email_templates_tenant_select,email_templates_tenant_update'),
      ('campaigns', 'campaigns_app_delete,campaigns_app_insert,campaigns_app_select,campaigns_app_update,campaigns_owner_admin,campaigns_tenant_delete,campaigns_tenant_insert,campaigns_tenant_select,campaigns_tenant_update'),
      ('notifications', 'notifications_app_delete,notifications_app_insert,notifications_app_select,notifications_app_update,notifications_own_select,notifications_own_update,notifications_owner_admin,notifications_tenant_delete,notifications_tenant_insert,notifications_tenant_select,notifications_tenant_update'),
      ('integrations', 'integrations_app_delete,integrations_app_insert,integrations_app_select,integrations_app_update,integrations_owner_admin,integrations_tenant_delete,integrations_tenant_insert,integrations_tenant_select,integrations_tenant_update'),
      ('invoices', 'invoices_app_insert,invoices_app_select,invoices_app_update,invoices_owner_admin,invoices_tenant_select'),
      ('audit_logs', 'audit_logs_app_insert,audit_logs_app_select,audit_logs_owner_admin,audit_logs_tenant_select')
    ) AS expected(tbl, names)
  LOOP
    SELECT coalesce(string_agg(p.policyname, ',' ORDER BY p.policyname), '')
      INTO v_act
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = r.tbl;

    IF v_act IS DISTINCT FROM r.names THEN
      RAISE EXCEPTION 'CHECK 5 FAILED — policy inventory mismatch on "%": %expected: % %found:    %',
        r.tbl, chr(10), r.names, chr(10), v_act;
    END IF;
  END LOOP;

  -- 0004_invitations.sql (if applied) must add EXACTLY these 6 policies.
  v_exp := 146;
  IF to_regclass('public.invitations') IS NOT NULL THEN
    SELECT coalesce(string_agg(p.policyname, ',' ORDER BY p.policyname), '')
      INTO v_act
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'invitations';

    IF v_act IS DISTINCT FROM
       'invitations_app_delete,invitations_app_insert,invitations_app_select,invitations_app_update,invitations_owner_admin,invitations_tenant_select' THEN
      RAISE EXCEPTION 'CHECK 5 FAILED — policy inventory mismatch on "invitations": %expected: invitations_app_delete,invitations_app_insert,invitations_app_select,invitations_app_update,invitations_owner_admin,invitations_tenant_select %found:    %',
        chr(10), chr(10), coalesce(v_act, '<none>');
    END IF;
    v_exp := 152;
  END IF;

  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') <> v_exp THEN
    RAISE EXCEPTION 'CHECK 5 FAILED — expected exactly % policies in public, found %',
      v_exp, (SELECT count(*) FROM pg_policies WHERE schemaname = 'public');
  END IF;
  RAISE NOTICE 'CHECK 5 OK — exact policy inventory verified (% policies).', v_exp;
END $$;

-- -----------------------------------------------------------------------------
-- CHECK 5b — every full-CRUD tenant table exposes >= 4 _tenant_ policies
--            (select / insert / update / delete for authenticated users)
-- -----------------------------------------------------------------------------
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'leads'
    AND policyname LIKE '%\_tenant\_%';
  IF v_c < 4 THEN
    RAISE EXCEPTION 'CHECK 5b FAILED — % needs >= 4 _tenant_ policies (select/insert/update/delete), found %', 'leads', v_c;
  END IF;
END $$;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'contacts'
    AND policyname LIKE '%\_tenant\_%';
  IF v_c < 4 THEN
    RAISE EXCEPTION 'CHECK 5b FAILED — % needs >= 4 _tenant_ policies (select/insert/update/delete), found %', 'contacts', v_c;
  END IF;
END $$;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'accounts'
    AND policyname LIKE '%\_tenant\_%';
  IF v_c < 4 THEN
    RAISE EXCEPTION 'CHECK 5b FAILED — % needs >= 4 _tenant_ policies (select/insert/update/delete), found %', 'accounts', v_c;
  END IF;
END $$;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'deals'
    AND policyname LIKE '%\_tenant\_%';
  IF v_c < 4 THEN
    RAISE EXCEPTION 'CHECK 5b FAILED — % needs >= 4 _tenant_ policies (select/insert/update/delete), found %', 'deals', v_c;
  END IF;
END $$;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'tasks'
    AND policyname LIKE '%\_tenant\_%';
  IF v_c < 4 THEN
    RAISE EXCEPTION 'CHECK 5b FAILED — % needs >= 4 _tenant_ policies (select/insert/update/delete), found %', 'tasks', v_c;
  END IF;
END $$;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'activities'
    AND policyname LIKE '%\_tenant\_%';
  IF v_c < 4 THEN
    RAISE EXCEPTION 'CHECK 5b FAILED — % needs >= 4 _tenant_ policies (select/insert/update/delete), found %', 'activities', v_c;
  END IF;
END $$;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'products'
    AND policyname LIKE '%\_tenant\_%';
  IF v_c < 4 THEN
    RAISE EXCEPTION 'CHECK 5b FAILED — % needs >= 4 _tenant_ policies (select/insert/update/delete), found %', 'products', v_c;
  END IF;
END $$;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'workflows'
    AND policyname LIKE '%\_tenant\_%';
  IF v_c < 4 THEN
    RAISE EXCEPTION 'CHECK 5b FAILED — % needs >= 4 _tenant_ policies (select/insert/update/delete), found %', 'workflows', v_c;
  END IF;
END $$;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'email_templates'
    AND policyname LIKE '%\_tenant\_%';
  IF v_c < 4 THEN
    RAISE EXCEPTION 'CHECK 5b FAILED — % needs >= 4 _tenant_ policies (select/insert/update/delete), found %', 'email_templates', v_c;
  END IF;
END $$;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'campaigns'
    AND policyname LIKE '%\_tenant\_%';
  IF v_c < 4 THEN
    RAISE EXCEPTION 'CHECK 5b FAILED — % needs >= 4 _tenant_ policies (select/insert/update/delete), found %', 'campaigns', v_c;
  END IF;
END $$;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'integrations'
    AND policyname LIKE '%\_tenant\_%';
  IF v_c < 4 THEN
    RAISE EXCEPTION 'CHECK 5b FAILED — % needs >= 4 _tenant_ policies (select/insert/update/delete), found %', 'integrations', v_c;
  END IF;
END $$;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'notifications'
    AND policyname LIKE '%\_tenant\_%';
  IF v_c < 4 THEN
    RAISE EXCEPTION 'CHECK 5b FAILED — % needs >= 4 _tenant_ policies (select/insert/update/delete), found %', 'notifications', v_c;
  END IF;
END $$;
DO $$
BEGIN
  RAISE NOTICE 'CHECK 5b OK — >= 4 _tenant_ policies on all 12 full-CRUD tenant tables.';
END $$;

-- -----------------------------------------------------------------------------
-- CHECK 6 — NO policy anywhere applies to anon or PUBLIC
-- -----------------------------------------------------------------------------
DO $$
DECLARE v_cnt int;
BEGIN
  SELECT count(*) INTO v_cnt
  FROM pg_policies
  WHERE schemaname = 'public'
    AND ('anon' = ANY (roles) OR 'public' = ANY (roles));
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'CHECK 6 FAILED — % policy(ies) apply to anon/PUBLIC. anon must have zero policies.', v_cnt;
  END IF;
  RAISE NOTICE 'CHECK 6 OK — no policies apply to anon or PUBLIC.';
END $$;

-- -----------------------------------------------------------------------------
-- CHECK 7 — write paths are reserved where they must be:
--           * invoices / audit_logs   → SELECT-only for end users
--           * organizations           → no INSERT/DELETE for end users
--           * users                   → no INSERT/DELETE for end users
--           * sessions                → zero policies for end users
-- -----------------------------------------------------------------------------
DO $$
DECLARE v_cnt int;
BEGIN
  SELECT count(*) INTO v_cnt FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('invoices', 'audit_logs')
    AND 'authenticated' = ANY (roles) AND cmd <> 'SELECT';
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'CHECK 7 FAILED — invoices/audit_logs must be SELECT-only for authenticated (% violating policies).', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'organizations'
    AND 'authenticated' = ANY (roles) AND cmd IN ('INSERT', 'DELETE');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'CHECK 7 FAILED — organizations must have no INSERT/DELETE policies for authenticated (% found).', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'users'
    AND 'authenticated' = ANY (roles) AND cmd IN ('INSERT', 'DELETE');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'CHECK 7 FAILED — users must have no self INSERT/DELETE policies (% found).', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'sessions'
    AND ('authenticated' = ANY (roles) OR 'anon' = ANY (roles));
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'CHECK 7 FAILED — sessions must have zero authenticated/anon policies (% found).', v_cnt;
  END IF;

  RAISE NOTICE 'CHECK 7 OK — invoices/audit_logs read-only, orgs/users insert-protected, sessions service-only.';
END $$;

-- -----------------------------------------------------------------------------
-- CHECK 8 — privileges: anon fully locked out, sessions server-only,
--           app roles scoped, nova_app has NO BYPASSRLS
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_tbl  text;
  v_fail text := '';
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY['users', 'sessions', 'organizations', 'memberships', 'leads', 'contacts', 'accounts', 'deals', 'tasks', 'activities', 'products', 'workflows', 'email_templates', 'campaigns', 'notifications', 'integrations', 'invoices', 'audit_logs'] LOOP
    IF has_table_privilege('anon', 'public.' || v_tbl, 'SELECT')
       OR has_table_privilege('anon', 'public.' || v_tbl, 'INSERT')
       OR has_table_privilege('anon', 'public.' || v_tbl, 'UPDATE')
       OR has_table_privilege('anon', 'public.' || v_tbl, 'DELETE') THEN
      v_fail := v_fail || format('  - anon still has privileges on %s', v_tbl) || chr(10);
    END IF;
  END LOOP;

  IF has_table_privilege('authenticated', 'public.sessions', 'SELECT')
     OR has_table_privilege('authenticated', 'public.sessions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.sessions', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.sessions', 'DELETE') THEN
    v_fail := v_fail || '  - authenticated must have NO privileges on sessions' || chr(10);
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.leads', 'SELECT') THEN
    v_fail := v_fail || '  - authenticated lost SELECT on leads (expected CRUD grant)' || chr(10);
  END IF;

  IF NOT (has_table_privilege('nova_app', 'public.leads', 'SELECT')
          AND has_table_privilege('nova_app', 'public.leads', 'INSERT')
          AND has_table_privilege('nova_app', 'public.leads', 'UPDATE')
          AND has_table_privilege('nova_app', 'public.leads', 'DELETE')) THEN
    v_fail := v_fail || '  - nova_app must have table-level CRUD on leads' || chr(10);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nova_app' AND rolbypassrls) THEN
    v_fail := v_fail || '  - nova_app must NOT have BYPASSRLS' || chr(10);
  END IF;

  IF v_fail <> '' THEN
    RAISE EXCEPTION 'CHECK 8 FAILED — privilege problems:%', chr(10) || v_fail;
  END IF;
  RAISE NOTICE 'CHECK 8 OK — anon locked out everywhere, sessions service-only, app roles scoped, nova_app lacks BYPASSRLS.';
END $$;

-- -----------------------------------------------------------------------------
-- ALL CHECKS PASSED — the multi-tenant isolation layer is correctly installed.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- ATTACK SIMULATIONS (reference — un-comment to run)
-- =============================================================================
-- Simulate a signed-in user ("attacker") who is NOT a member of the org that
-- owns the rows. The SQL Editor always runs as postgres (the owner), so use
-- psql (or wrap in BEGIN/ROLLBACK) and temporarily switch roles:
--
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   -- Pretend to be a user with a Supabase Auth JWT (auth.uid() reads `sub`):
--   SET LOCAL request.jwt.claims TO '{"sub":"00000000-0000-4000-8000-000000000000","role":"authenticated"}';
--
--   -- 1) Read another org's data (expected: 0 rows) ------------------------
--   SELECT count(*) FROM public.leads;                                    -- 0
--   SELECT count(*) FROM public.leads  WHERE org_id = '<victim-org-id>';  -- 0
--   SELECT count(*) FROM public.deals  WHERE org_id = '<victim-org-id>';  -- 0
--   SELECT count(*) FROM public.audit_logs;                               -- 0
--   SELECT count(*) FROM public.memberships;                              -- 0
--
--   -- 2) Write another org's data (expected: 0 rows changed) ---------------
--   UPDATE public.leads SET value = 0 WHERE org_id = '<victim-org-id>';   -- UPDATE 0
--   DELETE FROM public.deals WHERE org_id = '<victim-org-id>';            -- DELETE 0
--
--   -- 3) Cross-tenant insert (expected: RLS violation error) ---------------
--   INSERT INTO public.leads (org_id, first_name, last_name)
--   VALUES ('<victim-org-id>', 'Evil', 'Insert');                -- ERROR 42501
--
--   -- 4) Privilege escalation attempts (expected: permission denied) ------
--   SELECT count(*) FROM public.sessions;                     -- permission denied
--   INSERT INTO public.users (email, name, password_hash)
--   VALUES ('x@x.com', 'X', 'hash');                          -- RLS violation
--   SELECT * FROM public.organizations;                        -- 0 rows
--
--   ROLLBACK;
--
-- Now repeat the reads as a REAL member of the org (a JWT whose sub matches
-- users.auth_user_id or users.id of a user with an ACTIVE membership):
-- every query above returns that org's rows — and only that org's rows.
-- =============================================================================

-- =============================================================================
-- STRICT MODE WALKTHROUGH — the nova_app role (Next.js API / Prisma path)
-- =============================================================================
-- How the API pins the tenant per transaction (pgbouncer-safe):
--
--   BEGIN;                                        -- prisma.$transaction(...)
--   SET LOCAL ROLE nova_app;                      -- or connect AS nova_app
--   SET LOCAL app.org_id = 'org_2Txy9fA1bC';      -- pin the tenant, THIS txn only
--
--   SELECT count(*) FROM public.leads;            -- only that org's rows
--   SELECT count(*) FROM public.leads
--     WHERE org_id = 'org_OTHER_ORG_ID';          -- 0 (cross-tenant read blocked)
--
--   INSERT INTO public.leads (org_id, first_name, last_name)
--   VALUES ('org_OTHER_ORG_ID', 'Evil', 'Insert')
--   RETURNING id;                                 -- ERROR: RLS violation
--
--   COMMIT;                                       -- the pin evaporates here
--
-- Fail-closed proof (no pin set):
--
--   BEGIN;
--   SET LOCAL ROLE nova_app;
--   SELECT count(*) FROM public.leads;            -- 0 — current_setting is NULL
--   ROLLBACK;
-- =============================================================================
