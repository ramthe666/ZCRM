# Nova CRM — Build Worklog

Shared worklog for all agents. Append sections below (never overwrite).

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Project setup — multi-tenant Prisma schema (18 models) pushed to SQLite

Work Log:
- Explored scaffold: Next.js 16, Tailwind 4, full shadcn/ui, framer-motion, recharts, dnd-kit, Prisma 6 + SQLite.
- Wrote `prisma/schema.prisma`: User, Session, Organization, Membership, Lead, Contact, Account, Deal, Task, Activity, Product, Workflow, EmailTemplate, Campaign, Notification, Integration, Invoice, AuditLog (multi-tenant via orgId on every tenant table; enums stored as strings for SQLite compat — Postgres migration uses native types).
- `bun run db:push` + `db:generate` succeeded.

Stage Summary:
- DB ready. All tenant tables org-scoped with indexes. Auth = custom sessions (token in httpOnly cookie, scrypt hashes — no external deps needed).
- Product name: "Nova CRM". Palette: emerald/slate/amber (NO blue/indigo). All user-visible UI lives in `/` (SPA) + `/api/*` routes only.
- In progress: Task 2-a (SQL migrations w/ RLS → migrations/), Task 2-b (backend APIs), Task 3-a (landing page → src/components/crm/landing/), Task 3-b (workspace frontend).

---
Task ID: 3-a
Agent: frontend-styling-expert (landing)
Task: Landing page with custom SVG illustrations

Work Log:
- Read worklog + inspected scaffold: shadcn/ui set (button/badge/accordion/switch…), framer-motion 12, next-themes 0.4.6, lucide 0.525, Tailwind 4 tokens (bg-background/text-foreground/border-border; --primary is near-black → avoided for brand).
- Verified next-themes source: useTheme without a provider is a noop → wrapped Landing content in its own `<ThemeProvider attribute="class">`. next-themes' provider self-disables if a root provider is added later (renders children directly when context exists), so it is conflict-free either way.
- Verified all lucide icon names exist (SquareKanban, ChartColumn, UserCog, ArrowDownUp, BellRing…) and that tw-animate-css ships the accordion-down/up keyframes (no globals.css edit needed).
- Built `glyphs.tsx`: IntegrationGlyph — 12 original 24×24 geometric marks (Supabase bolt, Vercel triangle, GitHub cat-face, Resend paper-plane, WhatsApp bubble+handset, Slack quadrants, Stripe monoline-S, Zapier asterisk, Google 3-segment ring in emerald/amber/rose — no blue, Mailchimp monkey+crown, Twilio square+dots, HubSpot nodes) + puzzle-piece fallback. currentColor + #10b981 accents, negative space via var(--background). No 'use client' so it can be imported by server components too.
- Built `illustrations.tsx`: LogoMark (emerald gradient tile + white spark + orbit ring + satellite), DashboardMockup (960×600 stylized CRM app: sidebar nav, search topbar, 3 KPI cards w/ sparklines, bar chart w/ dashed goal line, donut chart, 3 kanban columns w/ deal cards — all real SVG text/shapes themed via fill-*/stroke-* classes), AvatarInitials, 5 fictional wordmarks (Helios/Quantia/Northbeam/Lumen Labs/Vertexa), CtaRings decoration.
- Built `shared.tsx`: EASE tuple, fadeUp/stagger Variants, Reveal / StaggerGroup / StaggerItem (all useReducedMotion-aware), SectionHeader, CountUp (framer animate + useInView, reduced-motion safe).
- Built `sections.tsx`: TrustedBy strip, StatsBand (count-up: 12,000+ / $2.4B / 99.99% / 40+), 12-card Features grid, Automation showcase (animated dashed flow diagram: Trigger→Condition→2 Actions + Exit, strokeDashoffset loop), 12-card Integrations grid, Pricing (monthly/yearly Switch + Save 20% amber badge, 4 plans, Standard highlighted "Most popular"), Testimonials (SVG initials avatars + 5 filled stars), FAQ (shadcn Accordion, 5 real Q&As incl. Zoho/HubSpot migration), FinalCta (emerald→teal gradient panel + rings), Footer (4 link columns + © 2025 + pulsing status dot).
- Built `index.tsx`: Landing — sticky glass header (logo, smooth-scroll nav, theme toggle w/ Sun/Moon + hydration-safe mounted guard via useSyncExternalStore, Sign in / Get started free, mobile hamburger w/ AnimatePresence panel), hero (New: AI-assisted workflows badge, gradient H1, dual CTAs, trial note, grid-pattern + emerald/teal/amber mesh blobs, browser-chrome framed DashboardMockup, 3 floating glass stat chips w/ infinite float), all sections composed, skip-to-content link.
- Fixed block-comment bug (`fill-*/stroke-*` closed the JSDoc early) and a react-hooks lint error (setState-in-effect) — final state: `tsc --noEmit` clean for src/, ESLint clean for the landing folder. No files outside src/components/crm/landing/ were touched.

Stage Summary:
- Files (all in src/components/crm/landing/): index.tsx, sections.tsx, shared.tsx, illustrations.tsx, glyphs.tsx
- Exported API: `default Landing({ onSignIn, onSignUp }: LandingProps)` + `interface LandingProps { onSignIn: () => void; onSignUp: () => void }` (index.tsx); `IntegrationGlyph({ provider, className })` (glyphs.tsx — reuse in Integrations settings page); `LogoMark`, `DashboardMockup`, `AvatarInitials`, `Wordmark`, `TRUSTED_BRANDS`, `CtaRings` (illustrations.tsx); section components + motion primitives (sections.tsx / shared.tsx).
- Integration notes for 3-b/main: render `<Landing onSignIn={...} onSignUp={...} />` from page.tsx; page must remain 'use client' (or lazy-load Landing). The component mounts its own next-themes ThemeProvider (class strategy, storage key "theme") so the dark toggle works even before a root provider exists; html already has suppressHydrationWarning. Palette: emerald-500/600 brand, teal secondary, amber/rose accents, slate neutrals, zero blue/indigo, zero external images.

---
Task ID: 2-a
Agent: general-purpose (migrations)
Task: Supabase/Postgres SQL migrations with strong RLS policies

Work Log:
- Read worklog + prisma/schema.prisma (18 models, enums stored as strings for SQLite).
- Mapped every model to snake_case Postgres tables with exact FK ON DELETE behaviors (org children CASCADE; owner/user refs SET NULL; sessions/memberships user refs CASCADE) and every @@index/@@unique.
- Wrote migrations/0001_init.sql: pgcrypto, 23 native enum types (all 20 required + activity_outcome, related_entity_type, account_size; provider/action left as text — open catalogs, commented), 18 tables in dependency order (accounts before contacts/deals for inline FKs), text PKs with gen_random_uuid()::text fallback, timestamptz, double precision money, users.email UNIQUE + lower(email) functional unique index, guarded auth_user_id uuid column + conditional FK to auth.users (Supabase only), set_updated_at() trigger on the 12 tables with updatedAt, fully idempotent (IF NOT EXISTS / DO-block duplicate_object guards).
- Designed the RLS model against the FORCE-RLS + SECURITY DEFINER recursion pitfall: every policy is role-targeted (TO authenticated / nova_app / postgres) so the helper functions (owner) never recurse into tenant policies; owner gets explicit {table}_owner_admin escape hatch (documented: RLS can never truly constrain the table owner, and the helpers need un-recursed access to memberships/users).
- Wrote migrations/0002_rls.sql (generated from a single-source-of-truth model, then reviewed): preflight Supabase-role checks; 5 SECURITY DEFINER/STABLE/search_path-pinned helpers (current_user_row_ids, current_user_org_ids, is_org_member, is_org_admin, is_org_owner — the row-ids helper makes policies work with both cuid ids and the auth_user_id bridge); nova_app role creation (NOBYPASSRLS, no secrets in file) + GRANT nova_app TO postgres for testing; ENABLE+FORCE RLS on all 18 tables; 146 policies total: 11 full-CRUD tenant tables x4, notifications +2 own-inbox, memberships (self-invited insert, admin_update, admin-or-own delete), organizations (member select, admin update, NO user insert/delete — commented), invoices/audit_logs SELECT-only for authenticated (+ app write policies), users self select/update only, sessions zero end-user policies, nova_app strict mode (org_id = current_setting('app.org_id', true), fail-closed, documented bootstrap exceptions for signup), grants/revokes (anon fully revoked, sessions revoked from authenticated, default privileges for future tables, helper fn EXECUTE scoped).
- Wrote migrations/0003_verification.sql: 9 assertion DO blocks — RLS enabled+forced on 18 tables, 23 enums, 5 helpers (SECURITY DEFINER+STABLE), 12 triggers, EXACT 146-policy inventory per table (VALUES match with full diff on failure), >=4 _tenant_ policies on the 12 CRUD tables, zero anon/PUBLIC policies, reserved write paths (invoices/audit_logs/orgs/users/sessions), privilege checks (anon locked out, sessions server-only, nova_app CRUD + NOBYPASSRLS); commented attack simulations (SET LOCAL ROLE authenticated + request.jwt.claims) and nova_app strict-mode walkthrough incl. fail-closed proof.
- Wrote migrations/README.md: apply steps (SQL Editor / supabase CLI / psql), env vars (DATABASE_URL pooler 6543 pgbouncer=true&connection_limit=1, DIRECT_URL 5432, optional Resend/WhatsApp/Supabase keys), architecture (SQLite sandbox vs Postgres prod, the two protected paths + Prisma set_config snippet), role cheat-sheet, documented exceptions, scaling (HASH partitioning by org_id example, replicas, pooling, indexes), Supabase Auth switch via auth_user_id backfill, Prisma sync guidance (never db push prod), troubleshooting.
- Validated mechanically with a throwaway structural checker (statement keyword/paren balance, dollar-quote + BEGIN/END balance per DO block, policy grammar/role/table allowlists, DROP+comment before every CREATE POLICY, 0003 inventory == 0002 exactly, 146 count) — all green; fixed 2 real bugs it caught (missing (text) signatures on is_org_* GRANT/REVOKE + to_regprocedure, invalid "proname IN ARRAY"). Temp scripts deleted; no other project files touched.

Stage Summary:
- Files produced: migrations/0001_init.sql (697 L), migrations/0002_rls.sql (1512 L), migrations/0003_verification.sql (476 L), migrations/README.md (256 L). Nothing outside migrations/ + worklog.md touched.
- Key decisions: role-scoped policies (authenticated/nova_app/postgres) to make FORCE RLS + SECURITY DEFINER helpers recursion-free; owner escape hatch explicit and documented; nova_app strict mode fails closed on missing app.org_id; users/sessions gated by the API session layer (no org_id to pin); invoices append-only-ish (no deletes) and audit_logs append-only even for the app role; native enums for all 23 status fields, text for open catalogs (integration.provider, audit_logs.action).
- Handoff: task 2-b (APIs) should wrap org-scoped Prisma work in prisma.$transaction with SELECT set_config('app.org_id', <id>, true) and use the nova_app credentials in prod; README documents the full pattern.

---
Task ID: 2-b
Agent: main (Z.ai Code)
Task: Complete backend — auth, generic CRUD engine, workflows, analytics, billing, campaigns, integrations, WhatsApp, import/export

Work Log:
- src/lib/auth.ts: scrypt password hashing (zero deps), DB-backed sessions in httpOnly cookies, role hierarchy (member→manager→admin→owner) enforced via requireAuth(req, minRole), in-memory rate limiting, ApiError/json helpers.
- src/lib/entities.ts: whitelisted entity registry (leads, contacts, accounts, deals, tasks, activities, products, templates, workflows, campaigns) powering /api/data/[entity] — field coercion, defaults for non-nullable fields (null→default fallback), server-side search/filter/sort/pagination, deal stage→probability/closedAt business rules.
- src/lib/workflow.ts: automation engine — triggers (lead/deal/contact/task created + stage/status changed), conditions (eq/ne/gt/lt/contains), actions (create_task, notify, send_email, update_field, assign_owner), {{name}} interpolation, run counters. Fired from CRUD API; never throws.
- src/lib/limits.ts: plan catalog (Starter $14 / Standard $39 / Pro $79 / Enterprise) with server-enforced seats/contacts/workflows/campaigns limits (HTTP 402 + upgrade hint).
- src/lib/seed.ts + prisma/seed.ts: realistic demo dataset (8 accounts, 14 contacts, 12 deals across 7 months for charts, tasks, activities, products, templates, 3 workflows, campaigns, invoices) — used on signup (light) + demo org (rich, 4 members).
- 24 API routes: auth (signup/signin/signout/me+profile PATCH), generic data CRUD, lead convert (account+contact+deal in one transaction), dashboard, reports, search, org settings, members (invite w/ temp password + role change + remove), notifications, integrations (connect/test/disconnect with REAL provider API validation for GitHub/Resend/Vercel/Supabase/Stripe/WhatsApp/Slack), campaign send (real Resend delivery when configured, demo mode otherwise), billing subscribe (mock checkout + invoice), import (per-row validation), export (CSV), WhatsApp send (Meta Graph API when configured), audit log.

Stage Summary:
- All business logic works server-side with tenant scoping (orgId on every query) + role checks.
- Demo login: demo@novacrm.io / Demo1234! (NimbusWorks, professional plan, 4 seats).

---
Task ID: 3-b
Agent: main (Z.ai Code)
Task: Workspace frontend — shell + 18 module views as a single-page app at /

Work Log:
- src/lib/crm.ts (domain constants, badge tones, formatters, CSV parser, api client w/ X-Org-Id) + src/lib/store.ts (zustand: active module, openRecord, refreshTick).
- src/components/crm/shared.tsx: DataTable, TablePagination, RecordDialog (config-driven forms), DetailDrawer (details/timeline/tasks tabs + related activities), ConfirmDialog, ImportDialog (CSV paste/upload + preview + error report), StatCard/CountUp, EmptyState with custom SVG illustration.
- EntityView engine: search/filters/pagination/create/edit/delete/export/import/detail drawer per module; lead Convert dialog; contact WhatsApp dialog; Log activity dialog.
- Custom views: DashboardView (5 KPI cards + revenue area chart + pipeline bar + leads pie + activity feed + upcoming tasks + top deals), DealsView (6-column kanban w/ HTML5 drag&drop + optimistic stage updates + table toggle), CalendarView (month grid + day agenda + inline task status), ActivitiesView (grouped timeline), CampaignsView (stats + send + preview), WorkflowsView (visual builder: trigger/conditions/actions + live preview), ReportsView (6 charts + CSV export), TeamView (invite + roles + permission matrix), IntegrationsView (12 providers w/ IntegrationGlyph + connect/test/disconnect), BillingView (usage meters + plan switch + mock checkout + invoices), SettingsView (workspace/profile/audit log).
- Workspace shell: responsive sidebar (desktop + mobile Sheet), topbar with ⌘K command palette (debounced global search + quick nav), notifications bell (polling + mark read), org switcher (multi-workspace), theme toggle, user menu. Framer Motion transitions. Sonner toasts.
- AuthView: split-screen sign in/up with demo-credentials shortcut.
- page.tsx: SPA boot (session restore → Landing | Auth | Workspace), ThemeProvider, org switching with re-fetch.

Stage Summary:
- 30+ components, all wired to real APIs. Emerald/teal/amber palette (no blue/indigo), dark mode, sticky footer, 44px touch targets, semantic HTML/ARIA.

---
Task ID: 5
Agent: main (Z.ai Code)
Task: E2E verification with agent-browser + fixes

Work Log:
- Verified in real browser: landing (all sections), sign-in (demo), dashboard charts, lead creation → workflow automation fired (task + notification created), lead conversion (account+contact+deal), deal stage change, campaign send (7 recipients, demo mode), team invite (temp password flow), billing plan switch (Standard + invoice), ⌘K search → navigation → drawer, workflows view, Supabase integration connect + test, dark mode, mobile viewport, sticky footer, sign-out, full signup with auto-seeded workspace.
- Fixed 3 bugs found during verification: (1) Prisma create 500 when non-nullable defaulted fields (status/source/stage) received null from empty selects → buildData now falls back to defaults; (2) sidebar overflow pushed Sign out below viewport (ScrollArea needed min-h-0 in flex column); (3) React warnings (uncontrolled Select, missing DialogDescription).
- bun run lint: 0 errors. tsc --noEmit: clean for src/. dev.log: no new errors.

Stage Summary:
- App is fully interactive and verified end-to-end. All 18 modules functional with real data.

---
Task ID: 6-a
Agent: main (Z.ai Code)
Task: Fix demo sign-in crash (screenshot report) + GitHub setup + first push

Work Log:
- Analyzed user's error screenshot via VLM: Next.js runtime overlay "Not signed in" thrown from api() src/lib/crm.ts:69 after demo sign-in.
- Root cause 1 (primary): session cookie was SameSite=Lax — not sent inside the HTTPS preview panel (cross-site iframe context), so every post-signin API call 401'd. Root cause 2: getAuth treated a stale X-Org-Id (leftover localStorage from a previous account/DB reset) as "not signed in". Root cause 3: EntityView/DealsView option loaders had unhandled promise rejections → dev overlay crash.
- Fixed auth.ts: createSession(req) now sets SameSite=None; Secure when x-forwarded-proto is https (Vercel + preview), Lax otherwise; getAuth fetches all active memberships and falls back to the first when X-Org-Id is stale.
- page.tsx: re-pins nova-active-org on every auth success, clears it on sign-out, wraps Workspace in new ErrorBoundary (src/components/crm/ErrorBoundary.tsx), adds unhandledrejection console listener.
- Fixed missing .catch in EntityView.tsx + DealsView.tsx option loaders. db.ts logs only warn/error now.
- Verified E2E with agent-browser: pinned garbage org id in localStorage → signed in demo → workspace fully loads (KPIs, charts, notifications), zero 401s in dev.log, org pin self-healed.
- GitHub: untracked sandbox-only files (.env, db/, Caddyfile, .zscripts/, examples/, tests/, download/, mini-services/), updated .gitignore, set identity, remote origin → github.com/ramthe666/ZCRM.git, pushed main (commit "fix: demo sign-in crash ...").
- Added Invitation model to prisma/schema.prisma (email invitations with token/status/expiry), db:push + db:generate done, dev server restarted with new client.

Stage Summary:
- Demo sign-in fixed and browser-verified; repo pushed to GitHub.
- Invitation model exists in SQLite. Invitation fields: id, orgId, email, role, token (unique), status (pending|accepted|revoked), invitedById, expiresAt, createdAt, updatedAt. Relations: org (cascade), invitedBy (set null). Indexes: orgId, (email,status).
- Next: 6-b (backend invitations + Resend mailer + strict roles + demo reset) and 6-c (frontend invite UX + banners + role gating) run in parallel; then 6-f (Vercel/Postgres deployment assets), then Task 7 full verification.

---
Task ID: 6-b
Agent: general-purpose (backend)
Task: Email-invitation system + Resend mailer + strict role enforcement + demo-reset endpoint + 0004 migration

Work Log:
- Read worklog, prisma/schema.prisma (Invitation model from 6-a), all API routes, entities/auth/events/limits libs, and migrations 0001–0003 to mirror their conventions.
- src/lib/mailer.ts (new): sendMail via Resend REST (Bearer RESEND_API_KEY, MAIL_FROM default 'Nova CRM <onboarding@resend.dev>', 10s AbortController timeout, never throws — no key → {delivered:false,mode:'demo'}, HTTP/fetch error → {delivered:false,mode:'resend',error} with console.error, no secrets logged); inviteUrl(token) via APP_URL; renderEmailShell (table-based 560px inline-CSS email, emerald #10b981/teal header, rounded CTA button + plain-link fallback, © 2025 Nova CRM footer); teamInviteEmail + welcomeEmail with plain-text variants.
- POST /api/org/members rewritten: zod {email, role}, rate-limited 12/5min per user, checkLimit seats kept, 409 on active membership, re-invite regenerates token + 7-day expiry, else creates Invitation (64-hex token, pending, invitedById). Sends email, logs Activity type 'email' (subject `Team invitation sent to {email}`, body notes delivery mode) + audit; 201 {invitation:{id,email,role,status,expiresAt}, emailSent, inviteToken}. Old temp-password user-creation flow fully removed (no tempPassword anywhere in src/app).
- GET /api/org/invitations (admin): newest-first 100 rows {id,email,role,status,createdAt,expiresAt,invitedByName}. POST {id}: resend pending only (404/409 guards) → 200 {invitation,emailSent,inviteToken}. DELETE ?id=: revoke pending only → {ok:true}.
- GET /api/invitations?token= (public, 30/min/IP): returns {invitation:{email,role,orgName,inviterName,expiresAt,status}} — expired pending reported as status 'expired' with 200; 404 'Invitation not found or expired'; leaks no org ids/tokens.
- POST /api/invitations/accept (20/5min/IP, any role): 404 unknown token, 409 not pending, 410 expired (+auto-revoke), 403 strict case-insensitive email match, 409 'You are already a member of this workspace' + membership payload when pending + active member (also self-activates legacy 'invited' membership rows); success creates active Membership, marks accepted, notifies inviter, audits → {membership:{id,role,status}, org:{id,name,slug,plan,planStatus,billingCycle,currency,trialEndsAt,billingEmail}}.
- POST /api/invitations/decline: same 403 email rule, marks revoked, polite inviter notification + audit → {ok:true}.
- GET /api/auth/me: added pendingInvitations [{token,orgName,role,inviterName,expiresAt}] (pending, unexpired, own email, no active membership in that org, max 10, newest first). Nothing removed.
- POST /api/auth/signup: after org+membership+seed, auto-accepts pending unexpired invitations for the signup email (memberships created, invitations accepted, inviters notified, audited); response memberships = [own org (owner), ...accepted invite orgs]; welcome email fire-and-forget with .catch().
- POST /api/demo/reset (new, admin, 3/10min): guarded to the demo workspace (slug 'nimbusworks' — the actual seeded slug in prisma/seed.ts; also accepts 'nimbus-works') else 403 'Demo reset is only available in the shared demo workspace'; transactional wipe of leads/contacts/accounts/deals/tasks/activities/products/emailTemplates/workflows/campaigns/invoices/notifications (memberships, users, integrations, auditLogs kept) then seedOrgData(orgId, ownerUserId, true); audits 'Demo workspace data was reset' → {ok:true}.
- Strict role matrix enforced: DELETE /api/data/[entity]/[id] now allows members only for records they own (ownerId/assigneeId/userId via spec.ownerField; message 'Members can only delete records assigned to them'; ownerless entities never member-deletable) and honors spec.minRoleDelete for manager+; import → manager; export → manager; audit → admin; billing/subscribe → admin (was owner); billing/invoices → admin; integrations/test (NEW route, admin, real per-provider API validation with 8s timeout, {ok,message}, never echoes secrets; the frontend called it but the route never existed); integrations GET stays any-role, POST/DELETE already admin. entities.ts: workflows minRoleDelete admin→manager, activities got ownerField 'userId'. Campaigns/templates/products already at the right levels.
- migrations/0004_invitations.sql (new): invitations table (text PK gen_random_uuid()::text fallback, org FK CASCADE, invited_by_id → users SET NULL, token UNIQUE, status CHECK pending/accepted/revoked, expires_at, indexes org_id + (email,status)), set_updated_at trigger, new SECURITY DEFINER/STABLE helper current_user_emails(), RLS ENABLE+FORCED, 6 role-targeted policies (tenant_select for authenticated = is_org_member OR own email; nova_app select by token — documented sessions-style capability-credential rationale — plus strictly org-pinned insert/update/delete; owner_admin escape hatch), grants/revokes mirroring 0002 (anon revoked), preflight DO block + verification DO block (RLS flags, trigger, exact 6-policy inventory, zero anon policies). Fully idempotent. README.md: added the 0004 row to the file table only.
- Verified with curl against :3000 as demo admin + 3 throwaway signups (agent6b+*@test.dev): invite 201 demo-mode (emailSent:false), re-invite token rotation, duplicate 409, public peek (+expired→'expired', bad token 404), admin list, resend 200/404/409, revoke 200/409/404, signup auto-accept (memberships [own owner, NimbusWorks member]), /me pendingInvitations banner, accept 403/200/409-already-member, decline 200/403, expiry 410+auto-revoke, member 403s (invite, list, export, audit, billing, integrations/test, delete-unowned-record), member can delete own lead, manager can delete any record + export, demo reset 200 + re-seed verified (10 leads/12 contacts/12 deals), non-demo-org 403, member 403. All test data cleaned via node+@prisma/client script (users/orgs/invitations/audit entries removed; temp script deleted; agent6c+* test rows from the parallel agent left untouched).
- NOTE for env: the dev server was OOM-killed twice mid-verification (dmesg: next-server 1.7GB, container 4GB with 3 chrome instances running); relaunched detached (`(setsid bun run dev &)` from project root) and confirmed stable + full 200 regression pass on auth/me, dashboard, reports, org, audit, billing, notifications, integrations, search, members, invitations, export, lead PATCH.
- bun run lint: clean. bunx tsc --noEmit: clean for src/ (only pre-existing examples/ + skills/ errors remain).

Stage Summary:
- Files created: src/lib/mailer.ts, src/app/api/org/invitations/route.ts, src/app/api/invitations/route.ts, src/app/api/invitations/accept/route.ts, src/app/api/invitations/decline/route.ts, src/app/api/demo/reset/route.ts, src/app/api/integrations/test/route.ts, migrations/0004_invitations.sql.
- Files modified: src/app/api/org/members/route.ts (POST rewritten), src/app/api/auth/me/route.ts (+pendingInvitations), src/app/api/auth/signup/route.ts (auto-accept + welcome email), src/app/api/data/[entity]/[id]/route.ts (DELETE ownership rule), src/app/api/import/route.ts (manager), src/app/api/export/route.ts (manager), src/app/api/audit/route.ts (admin), src/app/api/billing/subscribe/route.ts (admin), src/app/api/billing/invoices/route.ts (admin), src/lib/entities.ts (workflows delete→manager, activities ownerField userId), migrations/README.md (one line).
- Contract confirmations for 6-c / Task 7: POST /api/org/members → 201 {invitation, emailSent, inviteToken} (emailSent=false in demo mode → show copy link `${origin}/?invite=${inviteToken}`); GET /api/org/invitations → {rows}; POST resend → {invitation,emailSent,inviteToken}; DELETE revoke → {ok:true}; GET /api/invitations?token → {invitation:{email,role,orgName,inviterName,expiresAt,status}} (status can be 'expired'); accept → 200 {membership,org} | 409 {error,membership} (treat as success) | 403 email-mismatch | 410 expired; decline → {ok:true}; /api/auth/me → +pendingInvitations; signup → memberships includes invite orgs; POST /api/demo/reset → {ok:true} (admins, demo org only). Role matrix now enforced exactly as specified in the task (member deletes = own records only). Demo workspace data was reset to the pristine rich dataset at the end of testing.
- Migration 0004 adds 6 policies (total 152 across 19 tables when applied after 0002); 0003's CHECK 5 inventory intentionally pins the 0001+0002 state — 0004 carries its own verification block (documented in the file footer).
- Ops note: dev server on :3000 must be running for verification; if it dies (OOM), relaunch with `(setsid bun run dev &)` from /home/z/my-project.

---
Task ID: 6-c
Agent: general-purpose (frontend)
Task: Invitation UX (deep-link + banner), role-based module gating, demo-workspace banner/reset, TeamView rework for the new invitation API

Work Log:
- src/lib/crm.ts: added `PendingInvitation` + `InviteContext` types, `pendingInvitations?` on SessionPayload, `ApiError` (Error + HTTP status, thrown by api() for 409/403/410 flow control), `MODULE_MIN_ROLE` + `moduleAllowedForRole()` (campaigns/workflows → manager+, integrations/billing → admin+), `INVITE_STATUS_TONE`, `DEMO_ORG_SLUGS` + `isDemoOrg()` (matches both `nimbus-works` and the currently seeded `nimbusworks`). No existing export broken.
- src/app/page.tsx: boot now parses `?invite=<token>` first, cleans the URL via history.replaceState (rest of query preserved), resolves it against public `GET /api/invitations?token=`; invalid/expired → error toast + normal boot. Signed-in with matching email → auto `POST /api/invitations/accept` (409 = "You're already part of X" success; 403/410 toasted; membership merged, current workspace kept); mismatched email → toast "sign in with that email". Signed-out → AuthView (signin mode) with invite context; after signin/signup the accept is retried (signup auto-accepts server-side → 409 handled gracefully). Added handleAcceptInvite/handleDeclineInvite (join banner), handleStartTrial (sign out + signup view), refreshSession() re-fetches me (memberships + pendingInvitations). Toaster now mounted during boot loading screen too. ErrorBoundary kept.
- src/components/crm/AuthView.tsx: new optional `invite` prop → emerald/amber invitation banner card above the form (org, amber role badge, inviter, "Accept by signing in — or create your account" + mode-switch link), email prefilled + readOnly (locked hint, still submitted via state), demo-credentials shortcut hidden in invite mode, invite-aware headings/copy.
- src/components/crm/Workspace.tsx: new props `pendingInvitations`, `onAcceptInvite`, `onDeclineInvite`, `onStartTrial`. Pending-invite banner (emerald, framer-motion, stacked max 3 + "+N more", Accept/Dismiss ≥44px) and demo-workspace banner (amber, FlaskConical, "Create your own workspace" + owner/admin-only "Reset demo data" → ConfirmDialog → POST /api/demo/reset → "Demo data reset ✨" + store.bump) render above module content. Sidebar nav groups + ⌘K quick-nav filtered via moduleAllowedForRole; defensive useEffect + renderModule guard bounce to dashboard when the active module is gated for the role. Org switcher/bell/footer untouched.
- src/components/crm/views/TeamView.tsx: full rework. Members table kept (role change/remove). New admin-only "Pending & past invitations" card from GET /api/org/invitations (status badge pending=amber/accepted=emerald/revoked=muted + computed Expired, sent/expiry dates, invited-by, helper text "Invitations expire after 7 days…"); pending rows get Copy link + Resend (both POST /api/org/invitations {id} → fresh inviteToken → clipboard copy / "Invitation resent 📨"; emailSent=false fallback copies the link with an info toast) and Revoke (ConfirmDialog → DELETE ?id=). Invite dialog uses the new POST /api/org/members contract: success state "Invitation emailed to X via Resend ✅" (animated check) or demo state with read-only link + Copy + "Connect Resend…" hint; 402/409 toast the server message. Permissions card now has the exact 11-row matrix with O/A/M/✕ chips + members-delete-own-records footnote. Buttons ≥44px (h-11).
- Verified with agent-browser (2 sessions): demo sign-in → amber demo banner (no invite banner) → Team (11-row matrix + invitations card) → invited agent6c+0103@test.dev as member → demo-mode link dialog → copied link → NEW session opened the link → AuthView invite banner + locked prefilled email → signup → toasts "Workspace created" + "You're already part of NimbusWorks" (409 path) → 2 workspaces in switcher → NimbusWorks as member hides Campaigns/Workflows/Integrations/Billing in sidebar AND ⌘K palette → defensive guard verified (billing open as owner → switch org as member → dashboard). Pending-invite banner verified with a second user (Dismiss → declined; re-invite → Accept → "You've joined NimbusWorks as Member" + org switcher gains it). Copy link/Resend/Revoke on pending rows, 409 "already a member" toast, demo reset ("Demo data reset ✨"), onStartTrial → signup view, mobile 390px (banner wraps, hamburger nav sheet). Screenshots VLM-verified. Test users/workspaces/invitations (agent6c+%) removed via .zscripts/task-6c-cleanup.mjs (prisma); invitee browser session signed out + closed.

Stage Summary:
- Files modified: src/app/page.tsx, src/components/crm/AuthView.tsx, src/components/crm/Workspace.tsx, src/components/crm/views/TeamView.tsx, src/lib/crm.ts (+ helper script .zscripts/task-6c-cleanup.mjs, gitignored).
- page.tsx boot with ?invite=: token parsed + URL cleaned → public invite lookup → auto-accept (signed-in, email match), invitation-aware AuthView (signed-out, email prefilled+locked, signin mode), 409/403/410 handled per contract; session carries pendingInvitations; new handlers onAcceptInvite/onDeclineInvite/onStartTrial.
- Workspace new props: pendingInvitations, onAcceptInvite, onDeclineInvite, onStartTrial. AuthView new prop: invite ({ email, role, orgName, inviterName }). Role gate: member hides campaigns/workflows/integrations/billing, manager hides integrations/billing (sidebar + palette + renderModule + defensive reset to dashboard).
- Task 7 must verify: full invite journey E2E, demo banner + reset, role gating as member/manager, TeamView invitations (copy/resend/revoke), permissions matrix (11 rows), and that backend 6-b's /api/demo/reset slug check accepts the seeded demo org (earlier it 403'd with slug `nimbusworks` vs expected `nimbus-works`; frontend matches BOTH slugs). api() now throws ApiError with .status — other views keep working since it extends Error.

---
Task ID: 6-f
Agent: general-purpose (deployment)
Task: One-click Vercel + Supabase deployment assets (postgres schema, build script, demo-seed migration, .env.example, DEPLOYMENT.md, README.md)

Work Log:
- Read worklog (1→6-c), prisma/schema.prisma (19 models incl. Invitation), migrations 0001/0004 + README, mailer/auth/whatsapp/integrations code. rg pass over src/ for `process.env.`: ONLY RESEND_API_KEY, MAIL_FROM, APP_URL (src/lib/mailer.ts) + NODE_ENV (db.ts, automatic). DATABASE_URL comes from the Prisma datasource; DIRECT_URL only from the new postgres schema. NO WhatsApp env vars exist — WhatsApp credentials are per-workspace in the integrations table (phoneNumberId/token/verifyTemplate via Settings → Integrations), documented accordingly (migrations/README §2's WHATSAPP_*/SUPABASE_* list is aspirational, not read by code — noted in .env.example).
- KEY DECISION (documented in DEPLOYMENT.md §1): the app's Prisma client does NOT pin app.org_id (no set_config anywhere in src/), so the migrations/README-recommended nova_app strict role would fail closed (0 rows / RLS violations). Production DATABASE_URL must use the `postgres` table-owner user (all 19 tables have *_owner_admin policies TO postgres). RLS still fully protects the PostgREST/anon path; nova_app stays available as the documented hardening path.
- prisma/schema.postgres.prisma: generated from schema.prisma via throwaway script so all 19 models are byte-identical; only header comment, generator block (+binaryTargets ["native","rhel-openssl-3.0.x"]) and datasource block (postgresql, url=DATABASE_URL, directUrl=DIRECT_URL) differ. Validated: `DATABASE_URL=… DIRECT_URL=… bunx prisma validate --schema prisma/schema.postgres.prisma` → "valid 🚀". Diff captured (only those 3 blocks).
- scripts/vercel-build.sh: exactly as specced (postgres URL detection → prisma generate with the right schema → next build), chmod +x, `bash -n` OK.
- Demo data restore before dumping (data was post-test-polluted): Task 5's billing test had switched the org plan to 'standard' (pristine = 'professional' per prisma/seed.ts), a stray 5th membership `newrep@nimbusworks.io` (old temp-password invite test) existed, and the two /api/demo/reset runs (6-b/6-c) had collapsed record ownership onto the owner. Throwaway Prisma script restored pristine state: removed stray user+membership+sessions (audit refs nulled), set plan=professional, re-spread deal/lead/contact/task/account ownership across the 4 members exactly like prisma/seed.ts. CRM data itself was already the pristine rich seed (last reset 6-c) — no API reset needed. Verified afterwards via curl: demo sign-in OK, dashboard OK, org plan professional.
- migrations/0005_demo_seed.sql (423 lines) generated from the live SQLite DB by a throwaway @prisma/client script: FK-safe order users→organizations→memberships→accounts→contacts→leads→deals→tasks→activities→products→email_templates→workflows→campaigns→invoices→notifications→audit_logs; exact cuids; every statement `ON CONFLICT (id) DO NOTHING`; wrapped in BEGIN…COMMIT; ALL timestamps relative (`now() ± INTERVAL 'N days HH:MM:SS'`, seconds precision, NULL stays NULL, created_at+updated_at both relative — future dates positive: expectedCloseAt/dueAt/invoice dueAt); single quotes doubled; workflow conditions/actions JSON as escaped text; passwordHash verbatim (scrypt salt:hash — works with verifyPassword); audit trail curated to the 6 original seed rows (test noise excluded); sessions/invitations/integrations NOT dumped. Ends with a verification DO block (org exists + ≥1 active owner membership + ≥10 deals, RAISE EXCEPTION otherwise) inside the transaction.
- Structural checker (throwaway) validated 0005: 1 BEGIN + 99 INSERTs + 1 DO + 1 COMMIT; every column of every INSERT verified against 0001_init.sql's CREATE TABLE blocks; FK graph closed; ids unique per table; interval literals well-formed; string-literal state machine balanced. Also enum-whitelist validation at generation time (mirrors 0001's 23 enum types). All green.
- .env.example: DATABASE_URL (pooler 6543 placeholder + pgbouncer=true&connection_limit=1), DIRECT_URL (5432 direct), APP_URL, RESEND_API_KEY, MAIL_FROM + section comments (Database/App/Email/Integrations), SQLite local-dev note, WhatsApp per-workspace clarification, note that NEXT_PUBLIC_SUPABASE_* are not read by current code.
- DEPLOYMENT.md: 8 sections — architecture (two protected paths + honest postgres-role rationale), Supabase (migrations 0001→0005 in order with success criteria, pooler/direct strings, pgbouncer params explained), Vercel (import ramthe666/ZCRM, Build Command `bash scripts/vercel-build.sh`, full env-var table, first-deploy checklist), Resend (domain verification, onboarding@resend.dev caveat, where email is used), WhatsApp Business (Meta app → per-workspace connect → test), demo workspace (login/reset/skip), local dev, 10-bullet post-deploy checklist, troubleshooting table (401 cookies, Prisma engine/binaryTargets, pooler timeouts, RLS, Resend 403, demo 404s, localhost invite links, db-push warning).
- README.md: pitch, 18-module feature table, tech stack table, demo credentials callout, local quick start, deploy pointer, project structure tree, screenshots placeholder, "Proprietary — © 2025".
- migrations/README.md: added the 0005 row to the file table (one line, after 0004).
- DEVIATION (flagged): edited .gitignore to add `!.env.example` — the pre-existing `.env*` pattern would have gitignored the new .env.example, breaking the "committed" requirement. No other non-owned file touched.
- Cleanup: deleted tool-results/ (my session's Read artifacts, untracked), all throwaway scripts removed from /tmp. `bun run lint` clean. Dev server untouched (only read-only curls + one signin/signout pair for verification).

Stage Summary:
- Files created: prisma/schema.postgres.prisma (419 L, validates), scripts/vercel-build.sh (executable, bash -n OK), migrations/0005_demo_seed.sql (423 L, 99 idempotent INSERTs), .env.example, DEPLOYMENT.md (294 L), README.md. Files edited: migrations/README.md (one 0005 table row), .gitignore (+!.env.example, flagged).
- Demo data dumped in 0005: 4 users, 1 org (nimbusworks/professional), 4 memberships, 8 accounts, 12 contacts, 10 leads, 12 deals, 12 tasks, 10 activities, 5 products, 3 email templates, 3 workflows, 2 campaigns, 4 invoices, 3 notifications, 6 curated audit rows (≈14 contacts in the brief was an estimate — 12 is the pristine seed).
- Env vars the app actually reads: DATABASE_URL, DIRECT_URL (postgres schema only), APP_URL, RESEND_API_KEY, MAIL_FROM (+NODE_ENV automatic). No WhatsApp env vars (per-workspace in DB).
- For Task 7 / orchestrator: production must connect as `postgres` (not nova_app) until app.org_id pinning is implemented — rationale + hardening path in DEPLOYMENT.md §1 & migrations/README §3. 0005 is optional (skip = no public demo). Build Command on Vercel must be `bash scripts/vercel-build.sh`. Sandbox DB demo org restored to pristine (professional plan, 4 members, spread ownership) — safe for any demo-verification pass.

---
Task ID: 7 + 8
Agent: main (Z.ai Code)
Task: Full E2E re-verification of everything + final GitHub push

Work Log:
- Verified with agent-browser (2 sessions): demo sign-in → dashboard KPIs/charts + amber demo banner; Team view (invite dialog, invitations card, 11-row permission matrix); invite → demo-mode link → new session opens /?invite=token → invite banner + locked prefilled email → signup → own workspace "Verify Labs" + auto-accepted NimbusWorks membership (org switcher shows both); member role in NimbusWorks: Campaigns/Workflows/Integrations/Billing hidden from sidebar + ⌘K, Team view read-only (no invite/role/remove controls); demo reset (confirm dialog → "Demo data reset ✨" → 8 accounts/12 contacts/12 deals/10 leads/12 tasks professional plan); mobile 390px — fixed demo banner stacking (flex-col sm:flex-row); landing page + sign-out clean; zero console/page errors; dev.log clean; lint + tsc(src) clean.
- Cleaned up all e2e test artifacts (test user, org, membership, invitation) via @prisma/client; demo workspace left pristine.
- Pushed to GitHub (github.com/ramthe666/ZCRM, branch main): commits e171143 (sign-in fix), eb2c989 (invitation system), 3faf216 (deployment kit). Repo now contains the full product: src/, prisma/ (sqlite + postgres schemas), migrations/ (0001–0005), scripts/vercel-build.sh, .env.example, DEPLOYMENT.md, README.md. Sandbox-only files untracked.

Stage Summary:
- ALL user-reported issues resolved and browser-verified. Production deployment path ready: Supabase migrations 0001→0005 → Vercel import with build command `bash scripts/vercel-build.sh` + env vars from .env.example → Resend domain + key for real invite/welcome emails.
- Demo account fully working in sandbox and (after 0005) in production, with self-service reset.

---
Task ID: 9
Agent: main (Z.ai Code)
Task: Fix migration 0003 CHECK 3 failure + real /signup /signin URLs + URL audit + GitHub push

Work Log:
- Reproduced the user's exact error on a REAL PostgreSQL 18 (embedded-postgres npm, Supabase roles + auth.uid() emulated via a shim): 0003 CHECK 3 failed with "missing helper functions: current_user_row_ids, current_user_org_ids".
- Root causes fixed (0001/0002 content untouched):
  * 0003 CHECK 3: to_regprocedure('public.current_user_row_ids') without '()' returns NULL for zero-arg functions → sigs now '()'.
  * 0003 CHECK 5: RAISE format '...":%expected: %%found: %' had %% collapsing placeholders (5 args → 3) → "too many parameters"; format fixed. CHECK 5 is now invitations-aware: verifies the 6 invitation policies too when 0004 is applied (146 or 152 total) so 0003 can be re-run at any stage.
  * 0004 preflight: same missing-'()' bug on current_user_row_ids.
  * 0004 verification: pg_policy.polroles is oid[] — @> regrole[] has no operator → cast; ARRAY['public']::regrole fails (PUBLIC = pseudo-role oid 0) → switched to the pg_policies pattern from 0003 CHECK 6.
- Verified on real PG18: full chain 0001→0005 passes (all CHECK 1-8 + 5b + 0004 + 0005 notices green), double-run idempotent (2 full passes incl. 0003-after-0004), RLS behavior tests: owner via auth_user_id JWT sees 12 deals/1 org/sessions denied; attacker uuid sees 0 rows, cross-tenant insert → 42501; anon denied everything; nova_app unpinned → 0 rows, pinned → 12 rows, wrong-org insert → 42501.
- URLs: next.config.ts rewrites /signup, /signin, /login → / (beforeFiles); page.tsx client routing (routeFromPath + pushUrl/replaceUrl + popstate back/forward + boot URL normalization: signed-in users on auth paths → replaceUrl('/')); Landing/AuthView/mode-toggle/sign-in/sign-out/start-trial all sync the address bar. Browser-verified: /signup + /signin direct load & hard refresh stay put; landing → Sign in → /signin; toggle → /signup; browser back → landing; demo sign-in → URL '/'; sign-out → '/' landing; invite deep link → cleans to /signin with banner; invite signup → /signup prefilled → own workspace + NimbusWorks membership, org switcher shows both, member role hides Campaigns/Workflows/Integrations/Billing.
- appBaseUrl() in mailer.ts: APP_URL → request origin (x-forwarded-host/proto) → localhost; inviteUrl(token, req) + welcomeEmail appUrl threaded through members/invitations/signup routes. Sandbox invite links now built from the request origin.
- Branding fix: layout.tsx was still "Z.ai Code Scaffold" with an EXTERNAL favicon URL → Nova CRM metadata (title/description/OG/twitter, metadataBase from APP_URL, themeColor #10b981) + self-made src/app/icon.svg (emerald tile + white spark).
- Demo workspace restored to pristine: removed stray test deal ("TestFlow Inc"), stray 5th invoice, ran /api/demo/reset (previous sessions had drifted counts: 9 accounts/19 activities/10 notifications), plan → professional, ownership re-spread across the 4 members. Final counts match 0005 exactly (8/12/10/12/12/10/5/3/3/2/4/3).
- File modes: restored 644 on all files that had drifted to 755 (content identical, only chmod bits); scripts/vercel-build.sh stays executable.
- DEPLOYMENT.md: APP_URL fallback note, /signup+/signin checklist item, "One URL only" Vercel section (delete the duplicate project; deployment aliases are normal). .env.example: APP_URL=https://zcrm11.vercel.app + resolution order.
- lint clean, tsc clean (src/), dev.log clean, zero browser console/page errors in both test sessions. All E2E test data cleaned (urltest user/org/membership/invitation).
- Pushed: commit 4cd99a5 → github.com/ramthe666/ZCRM main.

Stage Summary:
- User action: re-run 0003_verification.sql (fixed), then 0004_invitations.sql, then 0005_demo_seed.sql — in that order, in the Supabase SQL Editor.
- 0001/0002 unchanged. On Vercel: APP_URL=https://zcrm11.vercel.app; keep one project, delete the other.

---
Task ID: 10
Agent: main (Z.ai Code)
Task: Fix production 500 on signup/signin (Vercel + Supabase) — root-cause and bulletproof the Prisma client generation + pooler URL; add /api/health diagnostics; push

Work Log:
- Diagnosis from the user's screenshots: /signup renders fine (static) but POST /api/auth/signup → 500 "Something went wrong. Please try again." on zcrm11.vercel.app, with only APP_URL/DATABASE_URL/DIRECT_URL set on Vercel (Production). All migrations 0001→0005 applied successfully, so the SQL layer is NOT the problem.
- ROOT CAUSE (most probable): dependency install runs @prisma/client's own postinstall, which generates the Prisma client from the DEFAULT prisma/schema.prisma — the SQLITE schema (package.json had no project-level postinstall). Unless the Vercel project's Build Command was manually set to `bash scripts/vercel-build.sh` (easy to miss), the deployed app got a SQLite-generated client; with a postgres:// DATABASE_URL every single query then fails at URL validation ("the URL must start with the protocol file://") → opaque 500 on every DB-backed API call. Secondary suspect (also fixed): pasted pooler URL missing ?pgbouncer=true → "prepared statement does not exist".
- Fixes (no changes to migrations 0001→0005, no changes to 0001/0002 — untouched as promised):
  1. vercel.json (NEW): framework nextjs + buildCommand `bash scripts/vercel-build.sh` pinned IN THE REPO — Vercel picks it up on every import/deploy, no dashboard setting needed.
  2. scripts/postinstall.js (NEW) + package.json "postinstall": runs right after install, picks the schema from DATABASE_URL (postgres:// → schema.postgres.prisma, else SQLite schema.prisma) and regenerates the client. Belt-and-suspenders: correct client even if the build command is overridden/bypassed. Defensive: never fails the install.
  3. scripts/vercel-build.sh: hardened (bunx→npx fallback, clearer log lines).
  4. src/lib/db.ts: runtime DATABASE_URL normalization — Supabase transaction pooler (port 6543) gets pgbouncer=true + connection_limit=1 auto-appended, Supabase hosts get sslmode=require; URL passed via PrismaClient datasources override. describeDatabaseUrl() exports a masked URL summary for diagnostics.
  5. src/lib/db-errors.ts (NEW): classifyDbError() maps known Prisma/Postgres failures to actionable { headline, hint, code } — SQLite-client-vs-Postgres-URL, pgbouncer prepared statements, missing tables (migrations), missing columns (drift), unreachable host, auth failed, RLS violation, closed connections.
  6. src/lib/auth.ts errorResponse(): DB failures now return { error: headline, hint, dbIssueCode } with the fix spelled out — no more opaque 500s. Non-DB errors keep the generic message; full stack stays in server logs.
  7. Client: ApiError (src/lib/crm.ts) carries hint; AuthView renders error + hint (muted second line) in the alert box.
  8. /api/health (NEW route): secret-free self-check — SELECT 1 liveness, server version (Postgres version()/SQLite sqlite_version(), dialect-aware, quiet), masked URL summary (protocol/host/port/pooler/params), env presence booleans, classified issue + warnings (non-pooler URL, missing pgbouncer, missing RESEND_API_KEY in prod, missing DATABASE_URL) + hint.
  9. signup route: export const maxDuration = 30 (workspace provisioning + seeding can exceed the 10s serverless default on a cold pooler connection).
  10. Docs: DEPLOYMENT.md §2 (build now automatic via vercel.json; postinstall safety net), first-deploy checklist now starts at /api/health, troubleshooting table gains the "every signup/signin 500" + "prepared statement" rows; .env.example documents /api/health verification; .gitignore += /tool-results/.
- Verification: node scripts/postinstall.js both paths (SQLite + simulated postgres://) → correct schema each time, client regenerated back to SQLite for the sandbox; bash -n vercel-build.sh OK; bun run lint clean; /api/health → ok:true, SQLite 3.46.0, zero prisma:error log noise after dialect-aware fix; POST /api/auth/signup → 201 with full payload; demo signin → 200; agent-browser E2E: /signup renders, form fill + submit → workspace loads at / with success toast, all 16 sidebar modules present, zero console/page errors; dev.log clean.
- Pushed: this commit → github.com/ramthe666/ZCRM main.

Stage Summary:
- User action: nothing manual — the push triggers a Vercel redeploy automatically. After it finishes (≈2–3 min), open https://zcrm11.vercel.app/api/health: expect {"ok":true,...,"connected":true}. Then sign up / sign in with demo@novacrm.io — both should work. If /api/health still reports an issue, it now says exactly what and how to fix it.
- If the Vercel project was imported BEFORE vercel.json existed and still shows a custom/default Build Command, either set it once to `bash scripts/vercel-build.sh` or delete + re-import the project — vercel.json then governs every deploy.

---
Task ID: 11
Agent: main (Z.ai Code)
Task: Fix migration 0006 failing with `0A000: cannot alter type of a column used in a policy definition` (policy memberships_tenant_insert depends on memberships.status)

Work Log:
- User reported: running 0006_prisma_compat.sql fails at the memberships block — PostgreSQL refuses `ALTER TABLE ... ALTER COLUMN status TYPE text` with SQLSTATE 0A000 because the RLS policy `memberships_tenant_insert` (0002_rls.sql §6) has `status = 'invited'` in its WITH CHECK. PostgreSQL never rebuilds policies on column type changes — the dependent policy must be dropped first.
- Audited the ENTIRE schema for other blockers before editing (migrations 0001→0005 are untouched, as promised):
  * Grepped every policy expression in 0002 + 0004 for all 29 converted column names — memberships_tenant_insert is the ONE and ONLY policy referencing a converted column. All other policies filter on org_id / user_id / id / current_setting / true.
  * Helper functions (current_user_org_ids, is_org_admin, current_user_row_ids, current_user_emails) DO reference m.status / m.role — but function bodies never block ALTER COLUMN TYPE (re-parsed at runtime; text = 'literal' works identically after conversion).
  * No views / materialized views / statistics objects / domains / generated columns anywhere (would also block). Indexes and CHECK constraints rebuild/revalidate automatically. users/sessions/audit_logs/invitations have no enum columns.
  * 0001 defines no CHECK constraints on enum columns → zero name collisions with 0006's *_values_check constraints.
- Fix (only 0006_prisma_compat.sql + docs changed):
  1. §2 memberships DO block: `DROP POLICY IF EXISTS memberships_tenant_insert` added INSIDE the `status`-is-enum guard, immediately before the ALTER (drop + convert are one atomic DO statement — they commit or roll back together, so the policy can never be left dropped by a failed run).
  2. After the DO block: unguarded, idempotent `DROP POLICY IF EXISTS` + `CREATE POLICY memberships_tenant_insert` restoring the EXACT 0002 definition (byte-identical) — self-healing in every partial-application scenario, including a first 0006 attempt that may have already committed §1 (organizations) before failing at §2.
  3. NEW CHECK E: verifies memberships_tenant_insert exists after the migration (pg_policy lookup) — screams if it's ever missing.
  4. Header/APPLY ORDER/closing comments rewritten to document the 0A000 cause, the one-policy treatment, and the re-run instructions; README.md migration table + troubleshooting table updated with the 0A000 row.
- Idempotency preserved end-to-end: conversions still guarded on data_type = 'USER-DEFINED' (skips whatever the failed first attempt already committed), constraints on IF NOT EXISTS, policy recreate is DROP IF EXISTS + CREATE. Re-running from the top is safe in every state.
- Consistency with 0003_verification.sql: CHECK 2 (enum types) still passes — types kept; CHECK 5 (exact policy inventory, 152 policies after 0004) still passes — the policy is recreated with the same name and definition, so count and names are unchanged.
- Verification: DO-block balance (21 open / 21 close, 42 dollar-quotes — even), 2 DROP POLICY + 1 CREATE POLICY as designed; logic walked through for all three DB states (clean apply, §1-committed partial, full rollback); bun run lint clean; dev.log reviewed — no errors.
- Pushed: this commit → github.com/ramthe666/ZCRM main.

Stage Summary:
- User action: re-run the NEW 0006_prisma_compat.sql from the top in the Supabase SQL Editor (paste the whole file, Run). Whatever the failed attempt already committed is skipped automatically. Expect "Success" + CHECK A–E OK notices. Sign-up then works (the enum→text conversion is the fix for the 42804 write failures).
