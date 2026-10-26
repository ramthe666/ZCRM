'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowDownUp,
  ArrowRight,
  BellRing,
  CalendarDays,
  ChartColumn,
  Check,
  CreditCard,
  GitBranch,
  ListChecks,
  Search,
  Send,
  SquareKanban,
  Star,
  UserCog,
  UserPlus,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

import { cn } from '@/lib/utils'

import { IntegrationGlyph } from './glyphs'
import { AvatarInitials, CtaRings, LogoMark, TRUSTED_BRANDS, Wordmark } from './illustrations'
import { CountUp, Reveal, SectionHeader, StaggerGroup, StaggerItem, fadeUp } from './shared'

/* ================================================================== */
/* Trusted-by strip                                                    */
/* ================================================================== */

export function TrustedBy() {
  return (
    <section aria-label="Trusted by" className="py-12 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-center text-sm font-medium text-muted-foreground">
            Trusted by revenue teams at fast-growing companies
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6 sm:gap-x-16">
            {TRUSTED_BRANDS.map((brand) => (
              <span
                key={brand}
                className="text-muted-foreground/70 transition-colors duration-300 hover:text-foreground"
              >
                <Wordmark name={brand} />
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================== */
/* Stats band                                                          */
/* ================================================================== */

const STATS = [
  { to: 12000, suffix: '+', decimals: 0, label: 'teams run their revenue on Nova' },
  { to: 2.4, prefix: '$', suffix: 'B', decimals: 1, label: 'in pipeline managed every year' },
  { to: 99.99, suffix: '%', decimals: 2, label: 'uptime, backed by an SLA' },
  { to: 40, suffix: '+', decimals: 0, label: 'native integrations out of the box' },
]

export function StatsBand() {
  return (
    <section aria-label="Nova CRM in numbers" className="border-y border-border bg-muted/40 py-14">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <CountUp
              to={stat.to}
              prefix={stat.prefix ?? ''}
              suffix={stat.suffix}
              decimals={stat.decimals}
              className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
            />
            <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ================================================================== */
/* Features grid                                                       */
/* ================================================================== */

const FEATURES = [
  { icon: SquareKanban, title: 'Deals & Pipeline', desc: 'Drag-and-drop kanban with stages, values, and drag-to-win.' },
  { icon: UserPlus, title: 'Lead Management', desc: 'Capture, score, and route every inbound lead automatically.' },
  { icon: Users, title: 'Contacts & Accounts', desc: 'Rich profiles with activity timeline, notes, and custom fields.' },
  { icon: ListChecks, title: 'Tasks & Activities', desc: 'Calls, to-dos, and next steps that never slip through.' },
  { icon: CalendarDays, title: 'Calendar & Meetings', desc: 'Two-way sync and scheduling links that book themselves.' },
  { icon: Send, title: 'Email Campaigns', desc: 'Targeted sequences from a visual template builder.' },
  { icon: Workflow, title: 'Automation Workflows', desc: 'Visual if-this-then-that builders for your whole funnel.' },
  { icon: ChartColumn, title: 'Reports & Analytics', desc: 'Cohorts, forecasts, and dashboards built for revenue.' },
  { icon: UserCog, title: 'Team & Roles', desc: 'Granular permissions, territories, and per-team pipelines.' },
  { icon: Search, title: 'Global Search', desc: 'Command-K across every deal, contact, and note.' },
  { icon: ArrowDownUp, title: 'Import / Export CSV', desc: 'One-click migration from Zoho, HubSpot, or spreadsheets.' },
  { icon: CreditCard, title: 'Billing & Usage', desc: 'Seats, invoices, and plan limits — transparent by default.' },
]

export function FeaturesSection() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="features-title"
          eyebrow="Features"
          title="Everything your revenue team needs"
          description="Twelve core modules in one fast workspace — no paid add-ons and no features locked behind enterprise tiers."
        />
        <StaggerGroup className="mt-14 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {FEATURES.map((feature) => (
            <StaggerItem key={feature.title} className="h-full">
              <div className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-600/5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 transition-colors duration-300 group-hover:bg-emerald-500/15 dark:text-emerald-400">
                  <feature.icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  )
}

/* ================================================================== */
/* Automation showcase                                                 */
/* ================================================================== */

const AUTOMATION_POINTS = [
  {
    icon: Zap,
    title: 'Trigger on anything',
    desc: 'Fire workflows the moment a lead arrives, a deal changes stage, or a form is submitted.',
  },
  {
    icon: GitBranch,
    title: 'Branch with conditions',
    desc: 'Route by source, score, territory, or owner — as many branches as you need, no code.',
  },
  {
    icon: BellRing,
    title: 'Act across your stack',
    desc: 'Create tasks, send emails and WhatsApp messages, or call out to webhooks — automatically.',
  },
]

function FlowDiagram() {
  const reduce = useReducedMotion()

  const flowLine = (d: string) => (
    <motion.path
      d={d}
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeDasharray="5 6"
      className="stroke-emerald-600/70 dark:stroke-emerald-400/70"
      initial={false}
      animate={reduce ? { strokeDashoffset: 0 } : { strokeDashoffset: [0, -22] }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 1.3, repeat: Infinity, ease: 'linear' }
      }
    />
  )

  return (
    <svg
      viewBox="0 0 480 340"
      role="img"
      aria-label="Workflow diagram: when a lead is created and its source is ads, a follow-up task is created and the deal owner is notified"
      focusable="false"
      className="block w-full"
    >
      {/* Trigger node */}
      <rect x={16} y={24} width={170} height={60} rx={14} className="fill-emerald-500/10 stroke-emerald-600/40" strokeWidth={1.5} />
      <circle cx={44} cy={54} r={15} fill="#059669" />
      <path d="M46 46l-6.5 9h4.6l-1.9 7 6.5-9h-4.6l1.9-7Z" fill="#fff" />
      <text x={66} y={50} fontSize={12} fontWeight={600} className="fill-foreground">
        Lead created
      </text>
      <text x={66} y={66} fontSize={8} letterSpacing={1.5} className="fill-muted-foreground">
        TRIGGER
      </text>

      {/* Trigger → condition */}
      {flowLine('M101 86V133')}
      <polygon points="96.5,134 105.5,134 101,141.5" className="fill-emerald-600/70 dark:fill-emerald-400/70" />

      {/* Condition diamond */}
      <polygon
        points="101,141 140,180 101,219 62,180"
        className="fill-amber-500/10 stroke-amber-500/60"
        strokeWidth={1.5}
      />
      <text x={101} y={177} fontSize={11} fontWeight={600} textAnchor="middle" className="fill-foreground">
        Source is ads?
      </text>
      <text x={101} y={192} fontSize={8} letterSpacing={1.5} textAnchor="middle" className="fill-muted-foreground">
        CONDITION
      </text>

      {/* Yes branch → action A */}
      <text x={150} y={172} fontSize={8.5} fontWeight={700} letterSpacing={1} className="fill-emerald-600 dark:fill-emerald-400">
        YES
      </text>
      {flowLine('M140 180H208V124H231')}
      <polygon points="231,119.5 231,128.5 238,124" className="fill-emerald-600/70 dark:fill-emerald-400/70" />

      {/* Action A */}
      <rect x={236} y={96} width={220} height={56} rx={14} className="fill-teal-500/10 stroke-teal-600/50 dark:stroke-teal-400/40" strokeWidth={1.5} />
      <circle cx={264} cy={124} r={15} fill="#0d9488" />
      <path d="m257 124 5 5 9-10" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <text x={286} y={120} fontSize={12} fontWeight={600} className="fill-foreground">
        Create follow-up task
      </text>
      <text x={286} y={135} fontSize={8} letterSpacing={1.5} className="fill-muted-foreground">
        ACTION · TASKS
      </text>

      {/* Action A → action B */}
      {flowLine('M346 152V189')}
      <polygon points="341,186 351,186 346,193.5" className="fill-emerald-600/70 dark:fill-emerald-400/70" />

      {/* Action B */}
      <rect x={236} y={196} width={220} height={56} rx={14} className="fill-teal-500/10 stroke-teal-600/50 dark:stroke-teal-400/40" strokeWidth={1.5} />
      <circle cx={264} cy={224} r={15} fill="#0d9488" />
      <path
        d="M264 216.5c-3 0-4.9 2.1-4.9 4.9v3.2l-1.5 2.5h12.8l-1.5-2.5v-3.2c0-2.8-1.9-4.9-4.9-4.9Z"
        fill="#fff"
      />
      <circle cx={264} cy={229} r={1.5} fill="#fff" />
      <text x={286} y={220} fontSize={12} fontWeight={600} className="fill-foreground">
        Notify deal owner
      </text>
      <text x={286} y={235} fontSize={8} letterSpacing={1.5} className="fill-muted-foreground">
        ACTION · NOTIFY
      </text>

      {/* No branch → exit */}
      <text x={110} y={240} fontSize={8.5} fontWeight={700} letterSpacing={1} className="fill-muted-foreground">
        NO
      </text>
      {flowLine('M101 219V276H138')}
      <polygon points="138,271.5 138,280.5 146,276" className="fill-muted-foreground/60" />
      <rect x={146} y={258} width={110} height={36} rx={18} className="fill-muted stroke-border" strokeWidth={1.5} />
      <text x={201} y={280.5} fontSize={11} textAnchor="middle" className="fill-muted-foreground">
        End workflow
      </text>
    </svg>
  )
}

export function AutomationSection() {
  return (
    <section
      id="automation"
      aria-labelledby="automation-title"
      className="relative scroll-mt-24 overflow-hidden py-20 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-20 size-[480px] rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-400/5"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <Reveal>
          <p className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
            <span className="h-px w-6 bg-emerald-500/60" aria-hidden="true" />
            Automation
          </p>
          <h2 id="automation-title" className="mt-4 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Automate the busywork
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Nova&apos;s visual builder turns repetitive sales chores into workflows that run 24/7 —
            accurately, and without complaint.
          </p>
          <ul className="mt-8 space-y-5">
            {AUTOMATION_POINTS.map((point) => (
              <li key={point.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400">
                  <point.icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{point.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{point.desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-muted-foreground">
            Teams on Nova automate an average of{' '}
            <span className="font-semibold text-foreground">148 tasks per month</span>.
          </p>
        </Reveal>
        <Reveal>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <FlowDiagram />
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-5">
              <span className="text-xs font-medium text-muted-foreground">Example</span>
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground">
                When lead created
              </span>
              <ArrowRight className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                If source is ads
              </span>
              <ArrowRight className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Create task + notify owner
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================== */
/* Integrations                                                        */
/* ================================================================== */

const INTEGRATIONS = [
  { provider: 'Supabase', blurb: 'Postgres backend & auth' },
  { provider: 'Vercel', blurb: 'Deploys & hosting' },
  { provider: 'GitHub', blurb: 'Repo activity sync' },
  { provider: 'Resend', blurb: 'Transactional email' },
  { provider: 'WhatsApp', blurb: 'Business messaging' },
  { provider: 'Slack', blurb: 'Deal alerts in channels' },
  { provider: 'Stripe', blurb: 'Payments & invoices' },
  { provider: 'Zapier', blurb: 'Connect 6,000+ apps' },
  { provider: 'Google Workspace', blurb: 'Gmail & Calendar sync' },
  { provider: 'Mailchimp', blurb: 'Campaign audiences' },
  { provider: 'Twilio', blurb: 'SMS & voice calls' },
  { provider: 'HubSpot', blurb: 'One-click migration' },
]

export function IntegrationsSection() {
  return (
    <section
      id="integrations"
      aria-labelledby="integrations-title"
      className="scroll-mt-24 bg-muted/30 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="integrations-title"
          eyebrow="Integrations"
          title="Plays nicely with your stack"
          description="Connect the tools your team already lives in — most setups take under two minutes."
        />
        <StaggerGroup className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {INTEGRATIONS.map((integration) => (
            <StaggerItem key={integration.provider} className="h-full">
              <div className="flex h-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md sm:p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60 text-foreground dark:bg-muted/40">
                  <IntegrationGlyph provider={integration.provider} className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{integration.provider}</p>
                  <p className="truncate text-xs text-muted-foreground">{integration.blurb}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
        <Reveal className="mt-8">
          <p className="text-center text-sm text-muted-foreground">
            …plus 30+ more through Zapier and our open REST API.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================== */
/* Pricing                                                             */
/* ================================================================== */

type Plan = {
  name: string
  tagline: string
  monthly?: number
  yearly?: number
  custom?: boolean
  popular?: boolean
  cta: string
  features: string[]
}

const PLANS: Plan[] = [
  {
    name: 'Starter',
    tagline: 'For small teams getting started',
    monthly: 14,
    yearly: 11,
    cta: 'Start free trial',
    features: ['Up to 3 seats', '1,000 contacts', '3 automation workflows', '2 email campaigns / month'],
  },
  {
    name: 'Standard',
    tagline: 'For growing sales teams',
    monthly: 39,
    yearly: 31,
    popular: true,
    cta: 'Start free trial',
    features: [
      'Up to 10 seats',
      '10,000 contacts',
      '10 automation workflows',
      'WhatsApp + call logging',
      'Email campaigns ×5 / month',
    ],
  },
  {
    name: 'Professional',
    tagline: 'For scaling revenue orgs',
    monthly: 79,
    yearly: 63,
    cta: 'Start free trial',
    features: [
      'Up to 25 seats',
      '50,000 contacts',
      '25 automation workflows',
      'Advanced reports & forecasting',
      'API access & webhooks',
    ],
  },
  {
    name: 'Enterprise',
    tagline: 'For complex organizations',
    custom: true,
    cta: 'Talk to sales',
    features: ['SSO / SAML & SCIM', 'Dedicated support', 'Custom seats & limits', 'Priority onboarding'],
  },
]

function PriceCard({
  plan,
  yearly,
  onSignUp,
}: {
  plan: Plan
  yearly: boolean
  onSignUp: () => void
}) {
  const price = plan.custom ? null : yearly ? plan.yearly : plan.monthly
  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        'relative flex h-full flex-col rounded-3xl border bg-card p-6 sm:p-7',
        plan.popular
          ? 'border-emerald-600/50 shadow-xl shadow-emerald-600/10 ring-2 ring-emerald-600/60 dark:shadow-emerald-500/10'
          : 'border-border shadow-sm'
      )}
    >
      {plan.popular ? (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-3.5 py-1 text-xs font-semibold text-white shadow-md shadow-emerald-600/30">
          Most popular
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{plan.tagline}</p>
      <div className="mt-5 flex items-baseline gap-1.5">
        {price === null ? (
          <span className="text-4xl font-extrabold tracking-tight text-foreground">Custom</span>
        ) : (
          <>
            <motion.span
              key={price}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="text-4xl font-extrabold tracking-tight text-foreground"
            >
              ${price}
            </motion.span>
            <span className="text-sm text-muted-foreground">/ user / mo</span>
          </>
        )}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {plan.custom ? 'Tailored to your organization' : yearly ? 'per user, billed yearly' : 'per user, billed monthly'}
      </p>
      <ul className="mt-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
      <Button
        onClick={onSignUp}
        variant={plan.popular ? 'default' : 'outline'}
        className={cn(
          'mt-7 w-full rounded-xl',
          plan.popular && 'bg-emerald-600 text-white hover:bg-emerald-500'
        )}
      >
        {plan.cta}
      </Button>
    </motion.div>
  )
}

export function PricingSection({ onSignUp }: { onSignUp: () => void }) {
  const [yearly, setYearly] = useState(true)
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="pricing-title"
          eyebrow="Pricing"
          title="Simple pricing that scales with your team"
          description="Start free and upgrade when you are ready. Every plan includes unlimited deals, the mobile app, and fast human support."
        />
        <Reveal className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <span
            className={cn(
              'text-sm font-medium transition-colors',
              !yearly ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            Monthly
          </span>
          <Switch
            checked={yearly}
            onCheckedChange={setYearly}
            aria-label="Toggle yearly billing"
            className="data-[state=checked]:bg-emerald-600"
          />
          <span
            className={cn(
              'text-sm font-medium transition-colors',
              yearly ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            Yearly
          </span>
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          >
            Save 20%
          </Badge>
        </Reveal>
        <StaggerGroup className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <PriceCard key={plan.name} plan={plan} yearly={yearly} onSignUp={onSignUp} />
          ))}
        </StaggerGroup>
        <Reveal className="mt-10">
          <p className="text-center text-sm text-muted-foreground">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================== */
/* Testimonials                                                        */
/* ================================================================== */

const TESTIMONIALS = [
  {
    name: 'Maya Chen',
    role: 'VP of Sales, Helios',
    initials: 'MC',
    tone: 'emerald' as const,
    quote:
      'We migrated 40,000 contacts from Zoho over a weekend. By Monday the team was closing deals — nobody has asked for the old tool back since.',
  },
  {
    name: 'Daniel Okafor',
    role: 'Head of Revenue Operations, Quantia',
    initials: 'DO',
    tone: 'teal' as const,
    quote:
      'The workflow builder replaced four Zapier zaps and a very tired spreadsheet. Follow-ups now happen in minutes, not days — our win rate is up 18%.',
  },
  {
    name: 'Sofia Marek',
    role: 'Founder, Lumen Labs',
    initials: 'SM',
    tone: 'amber' as const,
    quote:
      'Setup took one afternoon. Pipeline visibility went from vibes to a live dashboard my investors actually ask to see.',
  },
]

export function TestimonialsSection() {
  return (
    <section aria-labelledby="testimonials-title" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="testimonials-title"
          eyebrow="Testimonials"
          title="Loved by teams that live in their CRM"
          description="From two-person startups to 200-seat sales orgs, teams switch to Nova and stay."
        />
        <StaggerGroup className="mt-14 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <StaggerItem key={testimonial.name} className="h-full">
              <figure className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-1" role="img" aria-label="Rated 5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                  <AvatarInitials initials={testimonial.initials} tone={testimonial.tone} className="size-10" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  )
}

/* ================================================================== */
/* FAQ                                                                 */
/* ================================================================== */

const FAQS = [
  {
    q: 'Can I migrate from Zoho, HubSpot, or Pipedrive?',
    a: 'Yes. Nova\u2019s importer maps deals, contacts, notes, and custom fields from Zoho, HubSpot, Pipedrive, and plain CSVs — usually in under an hour. Yearly plans include free white-glove migration, and your old CRM can stay read-only while your team switches over.',
  },
  {
    q: 'How is my data secured?',
    a: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We are SOC 2 Type II certified, support EU or US data residency, and include role-based access controls, audit logs, and daily encrypted backups on every plan.',
  },
  {
    q: 'Which integrations are supported?',
    a: '40+ native integrations including Google Workspace, Slack, WhatsApp, Stripe, Resend, and Mailchimp — plus 6,000+ apps through Zapier and a full REST API with webhooks for anything custom.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Monthly plans cancel in one click from Billing and stay active until the end of the period. You can export everything — deals, contacts, notes, and files — as CSV or via the API at any time. No lock-in, no exit fees.',
  },
  {
    q: 'What are the free trial limits?',
    a: 'The 14-day trial includes every Professional feature with up to 3 seats and no credit card required. Import your real pipeline, invite the team, and only pick a plan when you are ready — all of your data carries over.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24 bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="faq-title"
          eyebrow="FAQ"
          title="Frequently asked questions"
          description="Everything else, our support team answers in under two minutes on average."
        />
        <Reveal className="mx-auto mt-12 max-w-3xl">
          <div className="rounded-2xl border border-border bg-card px-6 py-2 shadow-sm sm:px-8">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((faq, i) => (
                <AccordionItem key={faq.q} value={`faq-${i}`}>
                  <AccordionTrigger className="text-[15px] font-semibold text-foreground hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================== */
/* Final CTA                                                           */
/* ================================================================== */

export function FinalCta({ onSignUp }: { onSignUp: () => void }) {
  return (
    <section aria-labelledby="cta-title" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 px-6 py-16 text-center shadow-2xl shadow-emerald-600/20 sm:px-16 sm:py-20">
            <CtaRings className="pointer-events-none absolute inset-0 h-full w-full" />
            <div className="relative">
              <h2
                id="cta-title"
                className="mx-auto max-w-2xl text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl"
              >
                Ready to close more with less busywork?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-emerald-50/90 sm:text-lg">
                Join 12,000+ teams running their revenue on Nova CRM. Import your pipeline today —
                see the value this week.
              </p>
              <div className="mt-8">
                <Button
                  size="lg"
                  onClick={onSignUp}
                  className="h-12 rounded-full bg-white px-8 text-base font-semibold text-emerald-700 shadow-xl shadow-emerald-950/20 hover:bg-emerald-50"
                >
                  Start free trial
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <p className="mt-5 text-xs text-emerald-100/80">
                No credit card required · 14-day trial · Cancel anytime
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================== */
/* Footer                                                              */
/* ================================================================== */

const FOOTER_COLUMNS = [
  { title: 'Product', links: ['Features', 'Automation', 'Integrations', 'Pricing', 'Changelog'] },
  { title: 'Company', links: ['About', 'Careers', 'Blog', 'Press kit', 'Contact'] },
  { title: 'Resources', links: ['Help center', 'API docs', 'Community', 'Webinars', 'Status'] },
  { title: 'Legal', links: ['Privacy', 'Terms', 'DPA', 'Security', 'Cookies'] },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <LogoMark className="size-8" />
              <span className="text-base font-bold tracking-tight text-foreground">Nova CRM</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The CRM that works as hard as you do. Pipeline, contacts, email, and automation in
              one fast workspace.
            </p>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.title} aria-label={`Footer — ${column.title}`}>
              <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">© 2025 Nova CRM. All rights reserved.</p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-label="All systems operational">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            All systems operational
          </p>
        </div>
      </div>
    </footer>
  )
}
