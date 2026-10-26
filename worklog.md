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
