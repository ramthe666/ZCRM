-- =============================================================================
-- Nova CRM — 0005_demo_seed.sql
-- The shared demo workspace "NimbusWorks" (slug: nimbusworks)
-- =============================================================================
--
-- What this seeds (optional — the app works fine without it):
--   * 4 demo users + the demo organization (professional plan) + memberships
--     (owner / admin / manager / member) — a realistic team;
--   * the full rich sample dataset across every module: 8 accounts,
--     12 contacts, 10 leads, 12 deals (spread over ~7 months so
--     the dashboard/report charts look real), 12 tasks, 10 activities, 5 products,
--     3 email templates, 3 automation workflows, 2 campaigns, 4 invoices,
--     3 notifications and the curated seed audit trail.
--
-- Demo sign-in (also shown on the sign-in screen):
--   email:    demo@novacrm.io
--   password: Demo1234!
--   All four demo members (demo/sarah/marcus/priya @novacrm.io) share that
--   password; demo@novacrm.io is the workspace owner.
--
-- Requirements:
--   * Apply 0001_init.sql, 0002_rls.sql, 0003_verification.sql and
--     0004_invitations.sql FIRST (tables, enums, RLS, grants).
--   * Run as the `postgres` role (Supabase SQL Editor or psql) — the
--     *_owner_admin policies allow the inserts.
--
-- Idempotent + safe to re-run:
--   * every statement is INSERT ... ON CONFLICT (id) DO NOTHING;
--   * the whole file runs in a single transaction — any error rolls back
--     everything;
--   * a pre-existing user with the same email but a different id (or the same
--     org slug) would abort the run cleanly — delete it or skip this file.
--
-- Timestamps are RELATIVE: every date is emitted as now() ± INTERVAL '…' so
-- the demo data is always fresh whenever this migration runs (past created/
-- closed dates, future due dates / expected close dates).
--
-- Don't want a public demo workspace? Skip this file entirely — every new
-- signup seeds its own private sample data.
--
-- Generated from the live sandbox database by the 6-f deployment task.
-- =============================================================================

BEGIN;


-- ── 1. Users — the 4 demo team members (all use password Demo1234!; scrypt hashes) ───
INSERT INTO public.users (id, email, name, password_hash, title, phone, avatar_color, created_at, updated_at)
VALUES ('cmvp9ch4p0000wm49qhofm9st', 'demo@novacrm.io', 'Alex Morgan', '0593db73358df825cb6e12bb257fe247:3aa8ea0a30e8716d2c7303947a62288cf3b074e9fd75b7f929354d715e2f68f023a6b8e3f6931ed944c014b72c48317edaa8c9b100663315f4e5853f92aa9eb1', 'Head of Revenue', NULL, '#059669', now() - INTERVAL '0 days 01:28:06', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users (id, email, name, password_hash, title, phone, avatar_color, created_at, updated_at)
VALUES ('cmvp9ch5j0001wm49htgml9up', 'sarah@novacrm.io', 'Sarah Chen', 'e47eae8c4ac43dbb3daddc0093ec62ce:c654431b56d4f88cc4a432649608d2f8c433fb98c921968d3bbfd12fed3b0928b73a8a75313e326e8cf02e5ae794f06fdeee6a1ec9528b87ba1cbe6cf460e45b', 'Account Executive', NULL, '#0d9488', now() - INTERVAL '0 days 01:28:06', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users (id, email, name, password_hash, title, phone, avatar_color, created_at, updated_at)
VALUES ('cmvp9ch6d0002wm49mnxacrw3', 'marcus@novacrm.io', 'Marcus Reid', 'f1d66de441d373e8e155b6f95d0ee398:690d709cb9f41b74d1df8d3857f1cf71932456eca3fa74f28271e1b04d525c18a2608f9aaaa29cb2fc358cfb2660b409148a26af5bdc188288f122d0efdb3a8a', 'Sales Manager', NULL, '#d97706', now() - INTERVAL '0 days 01:28:06', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users (id, email, name, password_hash, title, phone, avatar_color, created_at, updated_at)
VALUES ('cmvp9ch780003wm49z9lbmw4y', 'priya@novacrm.io', 'Priya Sharma', '22b2f65b56ae2a8aa0d4c51245479007:d2218abb3ce5349d2a196f1b89501da452d84a16e6f4f1c56921a5ffad8c67fd9ae2d54d66a00e7ceef68b82eb986e8cecd2bc7addbda7633c5d276810474033', 'SDR', NULL, '#e11d48', now() - INTERVAL '0 days 01:28:06', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;

-- ── 2. Organization — the demo workspace (professional plan) ──────────────────
INSERT INTO public.organizations (id, name, slug, plan, billing_cycle, plan_status, trial_ends_at, billing_email, currency, created_at, updated_at)
VALUES ('cmvp9ch790004wm497pddatqc', 'NimbusWorks', 'nimbusworks', 'professional', 'monthly', 'active', NULL, 'billing@nimbusworks.io', 'USD', now() - INTERVAL '0 days 01:28:06', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;

-- ── 3. Memberships — owner / admin / manager / member ─────────────────────────
INSERT INTO public.memberships (id, user_id, org_id, role, status, created_at)
VALUES ('cmvp9ch7b0005wm49ixgx1ruw', 'cmvp9ch4p0000wm49qhofm9st', 'cmvp9ch790004wm497pddatqc', 'owner', 'active', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.memberships (id, user_id, org_id, role, status, created_at)
VALUES ('cmvp9ch7b0006wm49k70l0vy4', 'cmvp9ch5j0001wm49htgml9up', 'cmvp9ch790004wm497pddatqc', 'admin', 'active', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.memberships (id, user_id, org_id, role, status, created_at)
VALUES ('cmvp9ch7b0007wm49ym7y3m28', 'cmvp9ch6d0002wm49mnxacrw3', 'cmvp9ch790004wm497pddatqc', 'manager', 'active', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.memberships (id, user_id, org_id, role, status, created_at)
VALUES ('cmvp9ch7b0008wm49ablcfs37', 'cmvp9ch780003wm49z9lbmw4y', 'cmvp9ch790004wm497pddatqc', 'member', 'active', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;

-- ── 4. Accounts ───────────────────────────────────────────────────────────────
INSERT INTO public.accounts (id, org_id, name, website, phone, industry, size, tier, city, country, revenue, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajf0007wm7k1byehmef', 'cmvp9ch790004wm497pddatqc', 'Quantia Finance', 'quantia.fi', '+1 212 555 0188', 'Financial Services', '1000+', 'platinum', 'New York', 'United States', 120000000, 'cmvp9ch4p0000wm49qhofm9st', 'Security review required for all vendors.', now() - INTERVAL '171 days 02:48:18', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.accounts (id, org_id, name, website, phone, industry, size, tier, city, country, revenue, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajk000fwm7kkl38pw38', 'cmvp9ch790004wm497pddatqc', 'Orbit Health', 'orbithealth.ca', '+1 416 555 0164', 'Healthcare', '201-1000', 'silver', 'Toronto', 'Canada', 17000000, 'cmvp9ch4p0000wm49qhofm9st', 'HIPAA compliance questionnaire completed.', now() - INTERVAL '151 days 01:06:11', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.accounts (id, org_id, name, website, phone, industry, size, tier, city, country, revenue, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajg0009wm7kwy2b2yiq', 'cmvp9ch790004wm497pddatqc', 'Northbeam Logistics', 'northbeam.io', '+31 10 555 0173', 'Logistics', '201-1000', 'silver', 'Rotterdam', 'Netherlands', 22000000, 'cmvp9ch5j0001wm49htgml9up', 'EU data residency preferred.', now() - INTERVAL '143 days 12:42:13', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.accounts (id, org_id, name, website, phone, industry, size, tier, city, country, revenue, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajl000hwm7kl4qyd1zq', 'cmvp9ch790004wm497pddatqc', 'Cedar & Co', 'cedarandco.com.au', '+61 2 5550 0131', 'Retail', '51-200', 'standard', 'Sydney', 'Australia', 6000000, 'cmvp9ch5j0001wm49htgml9up', NULL, now() - INTERVAL '169 days 14:06:36', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.accounts (id, org_id, name, website, phone, industry, size, tier, city, country, revenue, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajh000bwm7kzkf5oytk', 'cmvp9ch790004wm497pddatqc', 'Lumen Labs', 'lumenlabs.bio', '+1 617 555 0119', 'Biotech', '51-200', 'standard', 'Boston', 'United States', 8000000, 'cmvp9ch6d0002wm49mnxacrw3', 'Grant-funded — price sensitive.', now() - INTERVAL '177 days 12:43:45', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.accounts (id, org_id, name, website, phone, industry, size, tier, city, country, revenue, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajn000jwm7klgbzzw35', 'cmvp9ch790004wm497pddatqc', 'Brightline Retail', 'brightlineretail.com', '+1 312 555 0126', 'Retail', '1000+', 'platinum', 'Chicago', 'United States', 88000000, 'cmvp9ch6d0002wm49mnxacrw3', 'Evaluate against legacy Zoho deployment.', now() - INTERVAL '176 days 11:21:42', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.accounts (id, org_id, name, website, phone, industry, size, tier, city, country, revenue, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3aje0005wm7khrjuww4n', 'cmvp9ch790004wm497pddatqc', 'Helios Energy', 'heliosenergy.com', '+1 512 555 0142', 'Renewable Energy', '201-1000', 'gold', 'Austin', 'United States', 45000000, 'cmvp9ch780003wm49z9lbmw4y', 'Expanding to 3 new states next quarter.', now() - INTERVAL '179 days 04:17:25', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.accounts (id, org_id, name, website, phone, industry, size, tier, city, country, revenue, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajj000dwm7kkwoewbdy', 'cmvp9ch790004wm497pddatqc', 'Vertexa Media', 'vertexa.media', '+44 20 5550 0155', 'Media & Entertainment', '201-1000', 'gold', 'London', 'United Kingdom', 31000000, 'cmvp9ch780003wm49z9lbmw4y', NULL, now() - INTERVAL '155 days 12:40:27', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;

-- ── 5. Contacts ───────────────────────────────────────────────────────────────
INSERT INTO public.contacts (id, org_id, first_name, last_name, email, phone, title, account_id, lifecycle, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajp000pwm7kz46az3s6', 'cmvp9ch790004wm497pddatqc', 'Sofia', 'Martinez', 'sofia.martinez@northbeam.io', '+31 10 555 0174', 'COO', 'cmvpc3ajg0009wm7kwy2b2yiq', 'customer', 'website', 'cmvp9ch4p0000wm49qhofm9st', NULL, now() - INTERVAL '106 days 16:35:50', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.contacts (id, org_id, first_name, last_name, email, phone, title, account_id, lifecycle, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajt000xwm7knhg4p3v1', 'cmvp9ch790004wm497pddatqc', 'Mia', 'Chen', 'mia.chen@cedarandco.com.au', '+61 2 5550 0132', 'Founder', 'cmvpc3ajl000hwm7kl4qyd1zq', 'lead', 'cold_call', 'cmvp9ch4p0000wm49qhofm9st', NULL, now() - INTERVAL '92 days 09:42:11', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.contacts (id, org_id, first_name, last_name, email, phone, title, account_id, lifecycle, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajx0015wm7k1zrb7w27', 'cmvp9ch790004wm497pddatqc', 'Isabella', 'Rossi', 'isabella.rossi@vertexa.media', '+44 20 5550 0157', 'Partnerships Manager', 'cmvpc3ajj000dwm7kkwoewbdy', 'marketing_qualified', 'website', 'cmvp9ch4p0000wm49qhofm9st', NULL, now() - INTERVAL '117 days 07:57:25', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.contacts (id, org_id, first_name, last_name, email, phone, title, account_id, lifecycle, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajq000rwm7kxn4tuwjv', 'cmvp9ch790004wm497pddatqc', 'Noah', 'Kim', 'noah.kim@lumenlabs.bio', '+1 617 555 0120', 'Lab Director', 'cmvpc3ajh000bwm7kzkf5oytk', 'sales_qualified', 'ads', 'cmvp9ch5j0001wm49htgml9up', NULL, now() - INTERVAL '99 days 04:29:54', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.contacts (id, org_id, first_name, last_name, email, phone, title, account_id, lifecycle, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3aju000zwm7kraspt2oo', 'cmvp9ch790004wm497pddatqc', 'Lucas', 'Weber', 'lucas.weber@brightlineretail.com', '+1 312 555 0127', 'SVP Digital', 'cmvpc3ajn000jwm7klgbzzw35', 'sales_qualified', 'referral', 'cmvp9ch5j0001wm49htgml9up', NULL, now() - INTERVAL '114 days 09:58:05', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.contacts (id, org_id, first_name, last_name, email, phone, title, account_id, lifecycle, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajy0017wm7k4hnv6t77', 'cmvp9ch790004wm497pddatqc', 'Arjun', 'Mehta', 'arjun.mehta@orbithealth.ca', '+1 416 555 0166', 'Head of Engineering', 'cmvpc3ajk000fwm7kkl38pw38', 'customer', 'social', 'cmvp9ch5j0001wm49htgml9up', NULL, now() - INTERVAL '113 days 21:06:21', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.contacts (id, org_id, first_name, last_name, email, phone, title, account_id, lifecycle, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajo000lwm7k36tq8x5b', 'cmvp9ch790004wm497pddatqc', 'Ava', 'Thompson', 'ava.thompson@heliosenergy.com', '+1 512 555 0143', 'VP Operations', 'cmvpc3aje0005wm7khrjuww4n', 'customer', 'referral', 'cmvp9ch6d0002wm49mnxacrw3', NULL, now() - INTERVAL '95 days 23:04:25', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.contacts (id, org_id, first_name, last_name, email, phone, title, account_id, lifecycle, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajr000twm7k8ey3w871', 'cmvp9ch790004wm497pddatqc', 'Emma', 'Wilson', 'emma.wilson@vertexa.media', '+44 20 5550 0156', 'Commercial Director', 'cmvpc3ajj000dwm7kkwoewbdy', 'sales_qualified', 'partner', 'cmvp9ch6d0002wm49mnxacrw3', NULL, now() - INTERVAL '129 days 01:10:49', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.contacts (id, org_id, first_name, last_name, email, phone, title, account_id, lifecycle, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajv0011wm7khuzvsl94', 'cmvp9ch790004wm497pddatqc', 'Olivia', 'Brown', 'olivia.brown@heliosenergy.com', '+1 512 555 0144', 'Procurement Lead', 'cmvpc3aje0005wm7khrjuww4n', 'customer', 'referral', 'cmvp9ch6d0002wm49mnxacrw3', NULL, now() - INTERVAL '132 days 16:04:13', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.contacts (id, org_id, first_name, last_name, email, phone, title, account_id, lifecycle, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajo000nwm7kma7iyk83', 'cmvp9ch790004wm497pddatqc', 'Liam', 'Rodriguez', 'liam.rodriguez@quantia.fi', '+1 212 555 0189', 'Head of IT', 'cmvpc3ajf0007wm7k1byehmef', 'customer', 'event', 'cmvp9ch780003wm49z9lbmw4y', NULL, now() - INTERVAL '132 days 20:13:19', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.contacts (id, org_id, first_name, last_name, email, phone, title, account_id, lifecycle, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajs000vwm7kj5zksd1t', 'cmvp9ch790004wm497pddatqc', 'Raj', 'Patel', 'raj.patel@orbithealth.ca', '+1 416 555 0165', 'CIO', 'cmvpc3ajk000fwm7kkl38pw38', 'marketing_qualified', 'social', 'cmvp9ch780003wm49z9lbmw4y', NULL, now() - INTERVAL '120 days 21:33:42', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.contacts (id, org_id, first_name, last_name, email, phone, title, account_id, lifecycle, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ajw0013wm7k6qt14b7n', 'cmvp9ch790004wm497pddatqc', 'Ethan', 'Diaz', 'ethan.diaz@quantia.fi', '+1 212 555 0190', 'Security Architect', 'cmvpc3ajf0007wm7k1byehmef', 'customer', 'event', 'cmvp9ch780003wm49z9lbmw4y', NULL, now() - INTERVAL '109 days 21:32:15', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;

-- ── 6. Leads ──────────────────────────────────────────────────────────────────
INSERT INTO public.leads (id, org_id, first_name, last_name, email, phone, company, title, source, status, value, notes, owner_id, converted_at, created_at, updated_at)
VALUES ('cmvpc3ak3001fwm7k89a342pl', 'cmvp9ch790004wm497pddatqc', 'Yuki', 'Tanaka', 'yuki.tanaka@sakuralabs.jp', '+81 3 5550 0187', 'Sakura Labs', 'GM', 'partner', 'contacted', 55000, NULL, 'cmvp9ch4p0000wm49qhofm9st', NULL, now() - INTERVAL '14 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leads (id, org_id, first_name, last_name, email, phone, company, title, source, status, value, notes, owner_id, converted_at, created_at, updated_at)
VALUES ('cmvpc3ak9001nwm7kdeqegz9a', 'cmvp9ch790004wm497pddatqc', 'Grace', 'Miller', 'grace@willowlegal.com', '+1 415 555 0139', 'Willow Legal', 'Managing Partner', 'website', 'unqualified', 5000, NULL, 'cmvp9ch4p0000wm49qhofm9st', NULL, now() - INTERVAL '40 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leads (id, org_id, first_name, last_name, email, phone, company, title, source, status, value, notes, owner_id, converted_at, created_at, updated_at)
VALUES ('cmvpc3ajz0019wm7kuj45pkqi', 'cmvp9ch790004wm497pddatqc', 'Chloe', 'Dubois', 'chloe@atelier-nine.fr', '+33 1 5550 0121', 'Atelier Nine', 'Creative Director', 'ads', 'new', 15000, NULL, 'cmvp9ch5j0001wm49htgml9up', NULL, now() - INTERVAL '3 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leads (id, org_id, first_name, last_name, email, phone, company, title, source, status, value, notes, owner_id, converted_at, created_at, updated_at)
VALUES ('cmvpc3ak5001hwm7kqttzji74', 'cmvp9ch790004wm497pddatqc', 'Diego', 'Fernandes', 'diego@coastalcraft.co', '+55 11 5550 0123', 'CoastalCraft', 'Head of Sales', 'social', 'qualified', 31000, NULL, 'cmvp9ch5j0001wm49htgml9up', NULL, now() - INTERVAL '20 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leads (id, org_id, first_name, last_name, email, phone, company, title, source, status, value, notes, owner_id, converted_at, created_at, updated_at)
VALUES ('cmvpc3aka001pwm7k8i47cled', 'cmvp9ch790004wm497pddatqc', 'Nina', 'Petrova', 'nina@balticsys.lv', '+371 6 555 0145', 'Baltic Systems', 'Ops Lead', 'ads', 'new', 22000, NULL, 'cmvp9ch5j0001wm49htgml9up', NULL, now() - INTERVAL '1 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leads (id, org_id, first_name, last_name, email, phone, company, title, source, status, value, notes, owner_id, converted_at, created_at, updated_at)
VALUES ('cmvpc3ak0001bwm7kfeu2u7ek', 'cmvp9ch790004wm497pddatqc', 'Hannah', 'Liu', 'hannah.liu@stackforge.dev', '+1 206 555 0117', 'StackForge', 'CTO', 'website', 'new', 42000, NULL, 'cmvp9ch6d0002wm49mnxacrw3', NULL, now() - INTERVAL '5 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leads (id, org_id, first_name, last_name, email, phone, company, title, source, status, value, notes, owner_id, converted_at, created_at, updated_at)
VALUES ('cmvpc3ak6001jwm7kpi1u9npd', 'cmvp9ch790004wm497pddatqc', 'Amara', 'Okafor', 'amara@solarisgrid.africa', '+234 1 555 0134', 'Solaris Grid', 'Procurement', 'referral', 'qualified', 68000, NULL, 'cmvp9ch6d0002wm49mnxacrw3', NULL, now() - INTERVAL '26 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leads (id, org_id, first_name, last_name, email, phone, company, title, source, status, value, notes, owner_id, converted_at, created_at, updated_at)
VALUES ('cmvpc3akb001rwm7kim2ybt16', 'cmvp9ch790004wm497pddatqc', 'Omar', 'Haddad', 'omar@dunefreight.ae', '+971 4 555 0128', 'Dune Freight', 'Director', 'referral', 'contacted', 95000, NULL, 'cmvp9ch6d0002wm49mnxacrw3', NULL, now() - INTERVAL '11 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leads (id, org_id, first_name, last_name, email, phone, company, title, source, status, value, notes, owner_id, converted_at, created_at, updated_at)
VALUES ('cmvpc3ak1001dwm7k8lxb2xai', 'cmvp9ch790004wm497pddatqc', 'Marcus', 'Hale', 'marcus@granitebuild.com', '+1 602 555 0192', 'Granite Build', 'Owner', 'cold_call', 'contacted', 8000, NULL, 'cmvp9ch780003wm49z9lbmw4y', NULL, now() - INTERVAL '9 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leads (id, org_id, first_name, last_name, email, phone, company, title, source, status, value, notes, owner_id, converted_at, created_at, updated_at)
VALUES ('cmvpc3ak8001lwm7k9bb7g9re', 'cmvp9ch790004wm497pddatqc', 'Tomas', 'Novak', 'tomas@brno-tools.cz', '+420 2 5550 0118', 'Brno Tools', 'CEO', 'event', 'unqualified', 2000, NULL, 'cmvp9ch780003wm49z9lbmw4y', NULL, now() - INTERVAL '32 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;

-- ── 7. Deals — spread over ~7 months for meaningful charts ────────────────────
INSERT INTO public.deals (id, org_id, name, account_id, contact_id, amount, stage, probability, expected_close_at, closed_at, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3akc001twm7kx287jq3w', 'cmvp9ch790004wm497pddatqc', 'Helios Energy — Platform Rollout', 'cmvpc3aje0005wm7khrjuww4n', 'cmvpc3ajo000lwm7k36tq8x5b', 120000, 'closed_won', 100, now() - INTERVAL '160 days 00:11:16', now() - INTERVAL '155 days 00:11:16', 'referral', 'cmvp9ch4p0000wm49qhofm9st', NULL, now() - INTERVAL '200 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.deals (id, org_id, name, account_id, contact_id, amount, stage, probability, expected_close_at, closed_at, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3akh0021wm7ka0btc3ls', 'cmvp9ch790004wm497pddatqc', 'Vertexa Media — Expansion Pack', 'cmvpc3ajj000dwm7kkwoewbdy', 'cmvpc3ajr000twm7k8ey3w871', 45000, 'negotiation', 80, now() + INTERVAL '11 days 23:48:44', NULL, 'partner', 'cmvp9ch4p0000wm49qhofm9st', NULL, now() - INTERVAL '38 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.deals (id, org_id, name, account_id, contact_id, amount, stage, probability, expected_close_at, closed_at, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3akl0029wm7kp6gcz1x5', 'cmvp9ch790004wm497pddatqc', 'Helios Energy — Add-on Modules', 'cmvpc3aje0005wm7khrjuww4n', 'cmvpc3ajv0011wm7khuzvsl94', 38000, 'qualification', 20, now() + INTERVAL '34 days 23:48:44', NULL, 'referral', 'cmvp9ch4p0000wm49qhofm9st', NULL, now() - INTERVAL '10 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.deals (id, org_id, name, account_id, contact_id, amount, stage, probability, expected_close_at, closed_at, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3akd001vwm7k3gote1b9', 'cmvp9ch790004wm497pddatqc', 'Quantia Finance — Enterprise License', 'cmvpc3ajf0007wm7k1byehmef', 'cmvpc3ajo000nwm7kma7iyk83', 85000, 'closed_won', 100, now() - INTERVAL '105 days 00:11:16', now() - INTERVAL '100 days 00:11:16', 'event', 'cmvp9ch5j0001wm49htgml9up', NULL, now() - INTERVAL '140 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.deals (id, org_id, name, account_id, contact_id, amount, stage, probability, expected_close_at, closed_at, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3aki0023wm7kpy1qqqsa', 'cmvp9ch790004wm497pddatqc', 'Orbit Health — Platform License', 'cmvpc3ajk000fwm7kkl38pw38', 'cmvpc3ajs000vwm7kj5zksd1t', 67000, 'value_prop', 60, now() + INTERVAL '20 days 23:48:44', NULL, 'social', 'cmvp9ch5j0001wm49htgml9up', NULL, now() - INTERVAL '30 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.deals (id, org_id, name, account_id, contact_id, amount, stage, probability, expected_close_at, closed_at, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3akn002bwm7k89bmq45s', 'cmvp9ch790004wm497pddatqc', 'Quantia Finance — Renewal 2025', 'cmvpc3ajf0007wm7k1byehmef', 'cmvpc3ajo000nwm7kma7iyk83', 90000, 'value_prop', 60, now() + INTERVAL '27 days 23:48:44', NULL, 'event', 'cmvp9ch5j0001wm49htgml9up', NULL, now() - INTERVAL '8 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.deals (id, org_id, name, account_id, contact_id, amount, stage, probability, expected_close_at, closed_at, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ake001xwm7k4cxsrtxs', 'cmvp9ch790004wm497pddatqc', 'Northbeam — Pilot Program', 'cmvpc3ajg0009wm7kwy2b2yiq', 'cmvpc3ajp000pwm7kz46az3s6', 24000, 'closed_won', 100, now() - INTERVAL '62 days 00:11:16', now() - INTERVAL '60 days 00:11:16', 'website', 'cmvp9ch6d0002wm49mnxacrw3', NULL, now() - INTERVAL '80 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.deals (id, org_id, name, account_id, contact_id, amount, stage, probability, expected_close_at, closed_at, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3akj0025wm7kkxmlwznl', 'cmvp9ch790004wm497pddatqc', 'Brightline — Multi-region Deployment', 'cmvpc3ajn000jwm7klgbzzw35', 'cmvpc3aju000zwm7kraspt2oo', 150000, 'negotiation', 80, now() + INTERVAL '17 days 23:48:44', NULL, 'referral', 'cmvp9ch6d0002wm49mnxacrw3', NULL, now() - INTERVAL '26 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.deals (id, org_id, name, account_id, contact_id, amount, stage, probability, expected_close_at, closed_at, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ako002dwm7k5mvsrhv0', 'cmvp9ch790004wm497pddatqc', 'Northbeam — Fleet Analytics', 'cmvpc3ajg0009wm7kwy2b2yiq', 'cmvpc3ajp000pwm7kz46az3s6', 28000, 'needs_analysis', 40, now() + INTERVAL '29 days 23:48:44', NULL, 'website', 'cmvp9ch6d0002wm49mnxacrw3', NULL, now() - INTERVAL '6 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.deals (id, org_id, name, account_id, contact_id, amount, stage, probability, expected_close_at, closed_at, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3akg001zwm7kruf11fmc', 'cmvp9ch790004wm497pddatqc', 'Orbit Health — Support Plan', 'cmvpc3ajk000fwm7kkl38pw38', 'cmvpc3ajs000vwm7kj5zksd1t', 8000, 'closed_lost', 0, now() - INTERVAL '32 days 00:11:16', now() - INTERVAL '30 days 00:11:16', 'social', 'cmvp9ch780003wm49z9lbmw4y', NULL, now() - INTERVAL '45 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.deals (id, org_id, name, account_id, contact_id, amount, stage, probability, expected_close_at, closed_at, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3akk0027wm7kpmivxr7d', 'cmvp9ch790004wm497pddatqc', 'Lumen Labs — Starter Plan', 'cmvpc3ajh000bwm7kzkf5oytk', 'cmvpc3ajq000rwm7kxn4tuwjv', 12000, 'needs_analysis', 40, now() + INTERVAL '24 days 23:48:44', NULL, 'ads', 'cmvp9ch780003wm49z9lbmw4y', NULL, now() - INTERVAL '18 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.deals (id, org_id, name, account_id, contact_id, amount, stage, probability, expected_close_at, closed_at, source, owner_id, notes, created_at, updated_at)
VALUES ('cmvpc3ako002fwm7k2ca9de9n', 'cmvp9ch790004wm497pddatqc', 'Vertexa Media — Ad Suite', 'cmvpc3ajj000dwm7kkwoewbdy', 'cmvpc3ajx0015wm7k1zrb7w27', 19000, 'qualification', 20, now() + INTERVAL '39 days 23:48:44', NULL, 'partner', 'cmvp9ch780003wm49z9lbmw4y', NULL, now() - INTERVAL '2 days 00:11:16', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;

-- ── 8. Tasks ──────────────────────────────────────────────────────────────────
INSERT INTO public.tasks (id, org_id, title, description, status, priority, due_at, related_type, related_id, assignee_id, created_by_id, created_at, updated_at)
VALUES ('cmvpc3akr002lwm7k6ktujhq0', 'cmvp9ch790004wm497pddatqc', 'Onboarding call with Northbeam', 'Walk through data import and user setup.', 'completed', 'normal', now() - INTERVAL '2 days 00:11:16', 'account', NULL, 'cmvp9ch4p0000wm49qhofm9st', NULL, now() - INTERVAL '29 days 09:36:03', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tasks (id, org_id, title, description, status, priority, due_at, related_type, related_id, assignee_id, created_by_id, created_at, updated_at)
VALUES ('cmvpc3al10031wm7kuagevc5b', 'cmvp9ch790004wm497pddatqc', 'Log Q2 call outcomes', NULL, 'completed', 'low', now() - INTERVAL '5 days 00:11:16', NULL, NULL, 'cmvp9ch5j0001wm49htgml9up', NULL, now() - INTERVAL '12 days 11:48:34', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tasks (id, org_id, title, description, status, priority, due_at, related_type, related_id, assignee_id, created_by_id, created_at, updated_at)
VALUES ('cmvpc3aky002xwm7k27ro1dry', 'cmvp9ch790004wm497pddatqc', 'Update CRM hygiene notes', 'Close stale opportunities.', 'deferred', 'low', now() + INTERVAL '13 days 23:48:44', NULL, NULL, 'cmvp9ch6d0002wm49mnxacrw3', NULL, now() - INTERVAL '16 days 09:50:28', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tasks (id, org_id, title, description, status, priority, due_at, related_type, related_id, assignee_id, created_by_id, created_at, updated_at)
VALUES ('cmvpc3akp002hwm7k677q2546', 'cmvp9ch790004wm497pddatqc', 'Send revised proposal to Vertexa Media', 'Include multi-year discount table.', 'in_progress', 'high', now() + INTERVAL '0 days 23:48:44', 'deal', NULL, 'cmvp9ch780003wm49z9lbmw4y', NULL, now() - INTERVAL '27 days 19:12:00', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tasks (id, org_id, title, description, status, priority, due_at, related_type, related_id, assignee_id, created_by_id, created_at, updated_at)
VALUES ('cmvpc3aku002rwm7k796qcb0v', 'cmvp9ch790004wm497pddatqc', 'Demo Brightline stakeholders', 'Multi-region architecture walkthrough.', 'in_progress', 'urgent', now() + INTERVAL '1 days 23:48:44', 'deal', NULL, 'cmvp9ch4p0000wm49qhofm9st', NULL, now() - INTERVAL '26 days 20:25:01', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tasks (id, org_id, title, description, status, priority, due_at, related_type, related_id, assignee_id, created_by_id, created_at, updated_at)
VALUES ('cmvpc3akz002zwm7k5t8cfdoj', 'cmvp9ch790004wm497pddatqc', 'Invite Orbit Health team to workspace', 'Raj wants 3 extra seats.', 'in_progress', 'normal', now() + INTERVAL '1 days 23:48:44', 'account', NULL, 'cmvp9ch5j0001wm49htgml9up', NULL, now() - INTERVAL '21 days 22:39:28', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tasks (id, org_id, title, description, status, priority, due_at, related_type, related_id, assignee_id, created_by_id, created_at, updated_at)
VALUES ('cmvpc3akq002jwm7khl7ftydb', 'cmvp9ch790004wm497pddatqc', 'Security questionnaire for Quantia renewal', 'Work with Ethan Diaz on SOC2 answers.', 'not_started', 'urgent', now() + INTERVAL '2 days 23:48:44', 'deal', NULL, 'cmvp9ch6d0002wm49mnxacrw3', NULL, now() - INTERVAL '13 days 09:55:48', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tasks (id, org_id, title, description, status, priority, due_at, related_type, related_id, assignee_id, created_by_id, created_at, updated_at)
VALUES ('cmvpc3aks002nwm7kxkhnsfvc', 'cmvp9ch790004wm497pddatqc', 'Follow up with Hannah Liu (StackForge)', 'She asked for a technical deep-dive.', 'not_started', 'high', now() - INTERVAL '0 days 00:11:16', 'lead', NULL, 'cmvp9ch780003wm49z9lbmw4y', NULL, now() - INTERVAL '13 days 21:06:47', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tasks (id, org_id, title, description, status, priority, due_at, related_type, related_id, assignee_id, created_by_id, created_at, updated_at)
VALUES ('cmvpc3akt002pwm7k0dy544ko', 'cmvp9ch790004wm497pddatqc', 'Prepare QBR deck for Helios Energy', NULL, 'not_started', 'normal', now() + INTERVAL '6 days 23:48:44', 'account', NULL, 'cmvp9ch4p0000wm49qhofm9st', NULL, now() - INTERVAL '26 days 09:14:40', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tasks (id, org_id, title, description, status, priority, due_at, related_type, related_id, assignee_id, created_by_id, created_at, updated_at)
VALUES ('cmvpc3akv002twm7ksrgzv9l3', 'cmvp9ch790004wm497pddatqc', 'Call Amara Okafor about Solaris Grid pilot', 'Referral from Ava Thompson.', 'not_started', 'high', now() + INTERVAL '0 days 23:48:44', 'lead', NULL, 'cmvp9ch5j0001wm49htgml9up', NULL, now() - INTERVAL '28 days 09:01:49', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tasks (id, org_id, title, description, status, priority, due_at, related_type, related_id, assignee_id, created_by_id, created_at, updated_at)
VALUES ('cmvpc3akx002vwm7kl0v90489', 'cmvp9ch790004wm497pddatqc', 'Send contract to Lumen Labs', 'Grant-friendly payment terms.', 'not_started', 'normal', now() + INTERVAL '3 days 23:48:44', 'deal', NULL, 'cmvp9ch6d0002wm49mnxacrw3', NULL, now() - INTERVAL '28 days 01:09:14', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tasks (id, org_id, title, description, status, priority, due_at, related_type, related_id, assignee_id, created_by_id, created_at, updated_at)
VALUES ('cmvpc3al20033wm7k8hjl5n6m', 'cmvp9ch790004wm497pddatqc', 'Draft Sakura Labs partnership terms', 'Yuki Tanaka intro from Vertexa.', 'not_started', 'normal', now() + INTERVAL '5 days 23:48:44', 'lead', NULL, 'cmvp9ch780003wm49z9lbmw4y', NULL, now() - INTERVAL '17 days 23:54:39', now() - INTERVAL '0 days 00:01:30')
ON CONFLICT (id) DO NOTHING;

-- ── 9. Activities ─────────────────────────────────────────────────────────────
INSERT INTO public.activities (id, org_id, type, subject, body, outcome, duration_min, related_type, related_id, user_id, occurred_at, created_at)
VALUES ('cmvpc3al30035wm7k4730s9iw', 'cmvp9ch790004wm497pddatqc', 'call', 'Discovery call — Vertexa expansion', 'Emma wants to add 40 seats before the media season.', 'interested', 45, NULL, NULL, 'cmvp9ch4p0000wm49qhofm9st', now() - INTERVAL '12 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.activities (id, org_id, type, subject, body, outcome, duration_min, related_type, related_id, user_id, occurred_at, created_at)
VALUES ('cmvpc3al6003bwm7k6atwgcsi', 'cmvp9ch790004wm497pddatqc', 'call', 'Pricing follow-up — Lumen Labs', 'Left voicemail, will retry Thursday.', 'no_answer', 5, NULL, NULL, 'cmvp9ch4p0000wm49qhofm9st', now() - INTERVAL '5 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.activities (id, org_id, type, subject, body, outcome, duration_min, related_type, related_id, user_id, occurred_at, created_at)
VALUES ('cmvpc3al8003hwm7kolo9vurt', 'cmvp9ch790004wm497pddatqc', 'call', 'Renewal talk — Liam Rodriguez', 'Wants to bundle premium support into renewal.', 'connected', 30, NULL, NULL, 'cmvp9ch4p0000wm49qhofm9st', now() - INTERVAL '11 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.activities (id, org_id, type, subject, body, outcome, duration_min, related_type, related_id, user_id, occurred_at, created_at)
VALUES ('cmvpc3ala003nwm7krcemqzz9', 'cmvp9ch790004wm497pddatqc', 'call', 'Lost-deal review — Orbit support plan', 'They chose an in-house solution for tier-1 support.', 'not_interested', 15, NULL, NULL, 'cmvp9ch4p0000wm49qhofm9st', now() - INTERVAL '28 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.activities (id, org_id, type, subject, body, outcome, duration_min, related_type, related_id, user_id, occurred_at, created_at)
VALUES ('cmvpc3al6003dwm7kd52vp8oy', 'cmvp9ch790004wm497pddatqc', 'email', 'Sent security pack to Quantia', 'SOC2 report + pen-test summary attached.', NULL, NULL, NULL, NULL, 'cmvp9ch4p0000wm49qhofm9st', now() - INTERVAL '4 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.activities (id, org_id, type, subject, body, outcome, duration_min, related_type, related_id, user_id, occurred_at, created_at)
VALUES ('cmvpc3al40037wm7kojkmuclc', 'cmvp9ch790004wm497pddatqc', 'meeting', 'Onboarding kickoff — Northbeam', 'Data migration plan agreed. Go-live in 2 weeks.', 'scheduled', 60, NULL, NULL, 'cmvp9ch4p0000wm49qhofm9st', now() - INTERVAL '9 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.activities (id, org_id, type, subject, body, outcome, duration_min, related_type, related_id, user_id, occurred_at, created_at)
VALUES ('cmvpc3al7003fwm7klhhmznvb', 'cmvp9ch790004wm497pddatqc', 'meeting', 'Executive demo — Orbit Health board', 'CIO loved the forecasting view.', 'interested', 90, NULL, NULL, 'cmvp9ch4p0000wm49qhofm9st', now() - INTERVAL '15 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.activities (id, org_id, type, subject, body, outcome, duration_min, related_type, related_id, user_id, occurred_at, created_at)
VALUES ('cmvpc3al50039wm7k7ik9p0kq', 'cmvp9ch790004wm497pddatqc', 'note', 'Competitive intel — Brightline', 'Currently evaluating against Zoho. Price + EU hosting are the deciding factors.', NULL, NULL, NULL, NULL, 'cmvp9ch4p0000wm49qhofm9st', now() - INTERVAL '7 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.activities (id, org_id, type, subject, body, outcome, duration_min, related_type, related_id, user_id, occurred_at, created_at)
VALUES ('cmvpc3ala003lwm7k3ce7r8q2', 'cmvp9ch790004wm497pddatqc', 'note', 'Helios expansion signals', 'Olivia mentioned 2 new business units launching Q3.', NULL, NULL, NULL, NULL, 'cmvp9ch4p0000wm49qhofm9st', now() - INTERVAL '2 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.activities (id, org_id, type, subject, body, outcome, duration_min, related_type, related_id, user_id, occurred_at, created_at)
VALUES ('cmvpc3al9003jwm7ktrkjwtqt', 'cmvp9ch790004wm497pddatqc', 'whatsapp', 'Quick question from Sofia Martinez', 'Asked about bulk import limits — answered with docs link.', NULL, NULL, NULL, NULL, 'cmvp9ch4p0000wm49qhofm9st', now() - INTERVAL '3 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;

-- ── 10. Products ──────────────────────────────────────────────────────────────
INSERT INTO public.products (id, org_id, name, sku, category, unit_price, billing_cycle, active, description, created_at, updated_at)
VALUES ('cmvpc3alb003pwm7kbjaxl1by', 'cmvp9ch790004wm497pddatqc', 'Nova Starter (per seat)', 'NOVA-ST', 'Subscription', 14, 'monthly', true, 'Core CRM for individuals.', now() - INTERVAL '0 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.products (id, org_id, name, sku, category, unit_price, billing_cycle, active, description, created_at, updated_at)
VALUES ('cmvpc3ale003rwm7k8ycbfp8m', 'cmvp9ch790004wm497pddatqc', 'Nova Standard (per seat)', 'NOVA-STD', 'Subscription', 39, 'monthly', true, 'Automation + campaigns for teams.', now() - INTERVAL '0 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.products (id, org_id, name, sku, category, unit_price, billing_cycle, active, description, created_at, updated_at)
VALUES ('cmvpc3alf003twm7kjmesoyf2', 'cmvp9ch790004wm497pddatqc', 'Nova Professional (per seat)', 'NOVA-PRO', 'Subscription', 79, 'monthly', true, 'Advanced analytics and API access.', now() - INTERVAL '0 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.products (id, org_id, name, sku, category, unit_price, billing_cycle, active, description, created_at, updated_at)
VALUES ('cmvpc3alf003vwm7kxvre9qjn', 'cmvp9ch790004wm497pddatqc', 'Onboarding & Migration', 'SVC-ONB', 'Service', 1500, 'one_time', true, 'Guided migration from any CRM.', now() - INTERVAL '0 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.products (id, org_id, name, sku, category, unit_price, billing_cycle, active, description, created_at, updated_at)
VALUES ('cmvpc3alg003xwm7kh49b75sm', 'cmvp9ch790004wm497pddatqc', 'Premium Support', 'SVC-SUP', 'Service', 500, 'monthly', true, '1-hour SLA, dedicated success manager.', now() - INTERVAL '0 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;

-- ── 11. Email templates ───────────────────────────────────────────────────────
INSERT INTO public.email_templates (id, org_id, name, subject, body, category, created_at, updated_at)
VALUES ('cmvpc3alh003zwm7kgmbb7jgq', 'cmvp9ch790004wm497pddatqc', 'Warm welcome', 'Welcome to {{name}} — let’s get you set up', 'Hi {{name}},

Thanks for joining Nova CRM. I’m here to help you import your data and set up your first pipeline.

Best,
The Nova Team', 'onboarding', now() - INTERVAL '0 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.email_templates (id, org_id, name, subject, body, category, created_at, updated_at)
VALUES ('cmvpc3ali0041wm7kqm07hrej', 'cmvp9ch790004wm497pddatqc', 'Post-demo follow-up', 'Great talking with you, {{name}}', 'Hi {{name}},

As promised, here’s the recap of today’s demo and the pricing we discussed. Happy to answer any questions.

Best,', 'sales', now() - INTERVAL '0 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.email_templates (id, org_id, name, subject, body, category, created_at, updated_at)
VALUES ('cmvpc3alj0043wm7kx0zuzj0n', 'cmvp9ch790004wm497pddatqc', 'Monthly product newsletter', 'What’s new in Nova — this month', 'Hello {{name}},

This month we shipped forecasting, WhatsApp messaging and faster search.

— Nova CRM', 'marketing', now() - INTERVAL '0 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;

-- ── 12. Workflows — conditions/actions are JSON strings ───────────────────────
INSERT INTO public.workflows (id, org_id, name, description, trigger, conditions, actions, active, run_count, last_run_at, created_at, updated_at)
VALUES ('cmvpc3alm0049wm7kza01ei5s', 'cmvp9ch790004wm497pddatqc', 'Hot deal alert (negotiation)', 'Notify the owner when a deal enters Negotiation.', 'deal.stage_changed', '[{"field":"stage","operator":"eq","value":"negotiation"}]', '[{"type":"notify","config":{"title":"🔥 {{name}} moved to Negotiation","body":"Review approval options before the next call."}}]', false, 22, NULL, now() - INTERVAL '0 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.workflows (id, org_id, name, description, trigger, conditions, actions, active, run_count, last_run_at, created_at, updated_at)
VALUES ('cmvpc3alk0045wm7k6csm4n6n', 'cmvp9ch790004wm497pddatqc', 'Ad lead → 24h follow-up', 'When a lead arrives from paid ads, create an urgent call task and notify the owner.', 'lead.created', '[{"field":"source","operator":"eq","value":"ads"}]', '[{"type":"create_task","config":{"title":"Call new ad lead {{name}} within 24h","dueInDays":1,"priority":"high","description":"Auto-created: ad-sourced lead needs fast qualification."}},{"type":"notify","config":{"title":"New ad-sourced lead: {{name}}","body":"A paid-ads lead just landed in your pipeline."}}]', true, 7, NULL, now() - INTERVAL '0 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.workflows (id, org_id, name, description, trigger, conditions, actions, active, run_count, last_run_at, created_at, updated_at)
VALUES ('cmvpc3all0047wm7kt96akhuq', 'cmvp9ch790004wm497pddatqc', 'Won deal — onboarding kit', 'When a deal is marked Closed Won, notify the owner and schedule the kickoff task.', 'deal.stage_changed', '[{"field":"stage","operator":"eq","value":"closed_won"}]', '[{"type":"notify","config":{"title":"🎉 Deal won: {{name}}","body":"Time to schedule onboarding!"}},{"type":"create_task","config":{"title":"Send onboarding kit for {{name}}","dueInDays":2,"priority":"high"}}]', true, 7, NULL, now() - INTERVAL '0 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;

-- ── 13. Campaigns ─────────────────────────────────────────────────────────────
INSERT INTO public.campaigns (id, org_id, name, template_id, segment, status, recipient_count, sent_count, open_count, click_count, sent_at, created_at, updated_at)
VALUES ('cmvpc3alo004dwm7k7z8z4kf8', 'cmvp9ch790004wm497pddatqc', 'Q3 re-engagement', 'cmvpc3ali0041wm7kqm07hrej', 'prospects', 'draft', 0, 0, 0, 0, NULL, now() - INTERVAL '0 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.campaigns (id, org_id, name, template_id, segment, status, recipient_count, sent_count, open_count, click_count, sent_at, created_at, updated_at)
VALUES ('cmvpc3alo004bwm7kspmny7yc', 'cmvp9ch790004wm497pddatqc', 'June product newsletter', 'cmvpc3alh003zwm7kgmbb7jgq', 'all', 'sent', 6, 6, 4, 2, now() - INTERVAL '18 days 00:11:16', now() - INTERVAL '0 days 00:11:16', now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;

-- ── 14. Invoices — billing history ────────────────────────────────────────────
INSERT INTO public.invoices (id, org_id, number, plan, cycle, seats, amount, currency, status, date, due_at)
VALUES ('cmvpc3alp004fwm7k7r80x7qw', 'cmvp9ch790004wm497pddatqc', 'NOVA-2025-0042', 'standard', 'monthly', 4, 156, 'USD', 'paid', now() - INTERVAL '95 days 00:11:16', now() + INTERVAL '9 days 23:48:44')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.invoices (id, org_id, number, plan, cycle, seats, amount, currency, status, date, due_at)
VALUES ('cmvpc3alq004hwm7kjfrwn7t8', 'cmvp9ch790004wm497pddatqc', 'NOVA-2025-0058', 'standard', 'monthly', 4, 156, 'USD', 'paid', now() - INTERVAL '64 days 00:11:16', now() + INTERVAL '9 days 23:48:44')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.invoices (id, org_id, number, plan, cycle, seats, amount, currency, status, date, due_at)
VALUES ('cmvpc3alr004jwm7kb1mu9ccf', 'cmvp9ch790004wm497pddatqc', 'NOVA-2025-0071', 'standard', 'monthly', 4, 156, 'USD', 'paid', now() - INTERVAL '34 days 00:11:16', now() + INTERVAL '9 days 23:48:44')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.invoices (id, org_id, number, plan, cycle, seats, amount, currency, status, date, due_at)
VALUES ('cmvpc3als004lwm7kc8f0n3hy', 'cmvp9ch790004wm497pddatqc', 'NOVA-2025-0089', 'standard', 'monthly', 4, 156, 'USD', 'open', now() - INTERVAL '4 days 00:11:16', now() + INTERVAL '9 days 23:48:44')
ON CONFLICT (id) DO NOTHING;

-- ── 15. Notifications ─────────────────────────────────────────────────────────
INSERT INTO public.notifications (id, org_id, user_id, title, body, type, read, link, created_at)
VALUES ('cmvpc3alu004mwm7kpx9u0roo', 'cmvp9ch790004wm497pddatqc', 'cmvp9ch4p0000wm49qhofm9st', 'Welcome to Nova CRM 👋', 'Sample data has been added so you can explore every module. Delete it anytime.', 'success', false, NULL, now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.notifications (id, org_id, user_id, title, body, type, read, link, created_at)
VALUES ('cmvpc3alu004nwm7kui8nd9t1', 'cmvp9ch790004wm497pddatqc', 'cmvp9ch4p0000wm49qhofm9st', 'Brightline deal moved to Negotiation', '$150,000 Multi-region Deployment is in the final stage.', 'deal', false, NULL, now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.notifications (id, org_id, user_id, title, body, type, read, link, created_at)
VALUES ('cmvpc3alu004owm7kze5eulrj', 'cmvp9ch790004wm497pddatqc', 'cmvp9ch4p0000wm49qhofm9st', 'Task due today', 'Follow up with Hannah Liu (StackForge).', 'task', false, NULL, now() - INTERVAL '0 days 00:11:16')
ON CONFLICT (id) DO NOTHING;

-- ── 16. Audit logs — the curated seed trail (test noise excluded) ─────────────
INSERT INTO public.audit_logs (id, org_id, user_id, action, entity, entity_id, summary, created_at)
VALUES ('cmvp9ch9t004uwm49ila4a0ow', 'cmvp9ch790004wm497pddatqc', 'cmvp9ch4p0000wm49qhofm9st', 'create', 'account', NULL, 'Sample workspace initialized with starter data', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.audit_logs (id, org_id, user_id, action, entity, entity_id, summary, created_at)
VALUES ('cmvp9ch9t004vwm49z2zw6ubg', 'cmvp9ch790004wm497pddatqc', 'cmvp9ch4p0000wm49qhofm9st', 'create', 'deal', NULL, 'Imported 12 sample deals', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.audit_logs (id, org_id, user_id, action, entity, entity_id, summary, created_at)
VALUES ('cmvp9ch9t004wwm49lj5z1n2i', 'cmvp9ch790004wm497pddatqc', 'cmvp9ch4p0000wm49qhofm9st', 'create', 'workflow', NULL, 'Installed 3 starter automation workflows', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.audit_logs (id, org_id, user_id, action, entity, entity_id, summary, created_at)
VALUES ('cmvp9chbr004xwm497nc7xwkg', 'cmvp9ch790004wm497pddatqc', 'cmvp9ch5j0001wm49htgml9up', 'update', 'deal', NULL, 'Sarah Chen moved Brightline deal to Negotiation', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.audit_logs (id, org_id, user_id, action, entity, entity_id, summary, created_at)
VALUES ('cmvp9chbr004ywm49qgo2efjd', 'cmvp9ch790004wm497pddatqc', 'cmvp9ch6d0002wm49mnxacrw3', 'create', 'campaign', NULL, 'Marcus Reid created campaign "Q3 re-engagement"', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.audit_logs (id, org_id, user_id, action, entity, entity_id, summary, created_at)
VALUES ('cmvp9chbr004zwm492hx8mwqk', 'cmvp9ch790004wm497pddatqc', 'cmvp9ch780003wm49z9lbmw4y', 'create', 'lead', NULL, 'Priya Sharma logged 2 new inbound leads', now() - INTERVAL '0 days 01:28:06')
ON CONFLICT (id) DO NOTHING;

-- ── 17. Verification ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org    text;
  v_owners int;
  v_deals  int;
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE slug = 'nimbusworks';
  IF v_org IS NULL THEN
    RAISE EXCEPTION '0005 CHECK FAILED — the demo organization (slug nimbusworks) was not seeded.';
  END IF;

  SELECT count(*) INTO v_owners
  FROM public.memberships
  WHERE org_id = v_org AND role = 'owner' AND status = 'active';
  IF v_owners < 1 THEN
    RAISE EXCEPTION '0005 CHECK FAILED — the demo organization has no active owner membership.';
  END IF;

  SELECT count(*) INTO v_deals FROM public.deals WHERE org_id = v_org;
  IF v_deals < 10 THEN
    RAISE EXCEPTION '0005 CHECK FAILED — demo organization expected at least 10 deals, found %.', v_deals;
  END IF;

  RAISE NOTICE '0005 OK — demo workspace verified (owner membership present, % deals, users can sign in with demo@novacrm.io).', v_deals;
END $$;

COMMIT;

-- =============================================================================
-- 0005 complete. The demo workspace is ready: sign in at {APP_URL} with
-- demo@novacrm.io / Demo1234! — or skip this file if you don't want a public
-- shared demo. Owners/admins can restore the pristine dataset any time with
-- the "Reset demo data" button (POST /api/demo/reset).
-- =============================================================================
