'use client'

import { useState, useSyncExternalStore, type MouseEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ThemeProvider, useTheme } from 'next-themes'
import {
  ArrowRight,
  Lock,
  Menu,
  Moon,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

import { DashboardMockup, LogoMark } from './illustrations'
import {
  AutomationSection,
  FaqSection,
  FeaturesSection,
  FinalCta,
  Footer,
  IntegrationsSection,
  PricingSection,
  StatsBand,
  TestimonialsSection,
  TrustedBy,
} from './sections'
import { EASE, StaggerGroup, StaggerItem } from './shared'

export interface LandingProps {
  onSignIn: () => void
  onSignUp: () => void
}

const NAV_LINKS = [
  { id: 'features', label: 'Features' },
  { id: 'automation', label: 'Automation' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
]

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* ------------------------------------------------------------------ */
/* Theme toggle                                                        */
/* ------------------------------------------------------------------ */

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  // False during SSR / hydration, true on the client — avoids mismatched markup.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative text-muted-foreground hover:text-foreground"
      aria-label="Toggle color theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {mounted ? (
        <>
          <Sun
            aria-hidden="true"
            className={`absolute size-[18px] transition-all duration-300 ${
              isDark ? 'scale-0 -rotate-90' : 'scale-100 rotate-0'
            }`}
          />
          <Moon
            aria-hidden="true"
            className={`absolute size-[18px] transition-all duration-300 ${
              isDark ? 'scale-100 rotate-0' : 'scale-0 rotate-90'
            }`}
          />
        </>
      ) : (
        <Sun aria-hidden="true" className="size-[18px] opacity-0" />
      )}
    </Button>
  )
}

/* ------------------------------------------------------------------ */
/* Sticky glassy header                                                */
/* ------------------------------------------------------------------ */

function Header({ onSignIn, onSignUp }: LandingProps) {
  const [open, setOpen] = useState(false)

  const handleLink = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault()
    setOpen(false)
    scrollToId(id)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label="Nova CRM — back to top"
        >
          <LogoMark className="size-8" />
          <span className="text-lg font-bold tracking-tight text-foreground">Nova CRM</span>
        </button>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(e) => handleLink(e, link.id)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
            onClick={onSignIn}
          >
            Sign in
          </Button>
          <Button
            className="hidden bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-500 sm:inline-flex"
            onClick={onSignUp}
          >
            Get started free
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="mobile-nav"
            key="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden border-t border-border/60 bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  onClick={(e) => handleLink(e, link.id)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false)
                    onSignIn()
                  }}
                >
                  Sign in
                </Button>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                  onClick={() => {
                    setOpen(false)
                    onSignUp()
                  }}
                >
                  Get started free
                </Button>
              </div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

const HERO_GRID_STYLE = {
  backgroundImage:
    'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
  backgroundSize: '54px 54px',
  maskImage: 'radial-gradient(ellipse 90% 65% at 50% 0%, black 35%, transparent 78%)',
  WebkitMaskImage: 'radial-gradient(ellipse 90% 65% at 50% 0%, black 35%, transparent 78%)',
}

const FLOATING_CHIPS = [
  {
    icon: TrendingUp,
    label: '+32% win rate',
    sub: 'vs. last quarter',
    position: 'left-4 top-14 sm:-left-8',
    iconClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    delay: 0,
  },
  {
    icon: Target,
    label: '$1.2M pipeline',
    sub: 'active this month',
    position: 'right-4 bottom-16 sm:-right-8',
    iconClass: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
    delay: 1.4,
  },
  {
    icon: Zap,
    label: '148 tasks automated',
    sub: 'in the last 7 days',
    position: 'right-8 -top-6',
    iconClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    delay: 0.7,
  },
]

function Hero({ onSignIn, onSignUp }: LandingProps) {
  const reduce = useReducedMotion()

  return (
    <section className="relative overflow-hidden pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pt-24">
      {/* Grid pattern */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={HERO_GRID_STYLE} />
      {/* Soft gradient blobs */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -top-44 left-[calc(50%-340px)] size-[680px] rounded-full bg-emerald-400/25 blur-3xl dark:bg-emerald-500/10"
        animate={reduce ? undefined : { scale: [1, 1.1, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-52 size-[420px] rounded-full bg-teal-400/15 blur-3xl dark:bg-teal-500/10"
        animate={reduce ? undefined : { x: [0, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-44 top-72 size-[380px] rounded-full bg-amber-400/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <StaggerGroup className="mx-auto max-w-3xl text-center">
          <StaggerItem>
            <a
              href="#automation"
              onClick={(e) => {
                e.preventDefault()
                scrollToId('automation')
              }}
              className="group inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 py-1 pl-1.5 pr-3 text-sm font-medium text-emerald-700 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/15 dark:text-emerald-300"
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                <Sparkles className="size-3" aria-hidden="true" />
                New
              </span>
              AI-assisted workflows
              <ArrowRight
                className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
          </StaggerItem>

          <StaggerItem>
            <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Close more deals with a CRM that{' '}
              <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-400">
                works as hard as you do
              </span>
            </h1>
          </StaggerItem>

          <StaggerItem>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Nova CRM brings your pipeline, contacts, email, and automations into one fast
              workspace — so your team spends the day selling, not updating spreadsheets.
            </p>
          </StaggerItem>

          <StaggerItem>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={onSignUp}
                className="h-12 rounded-full bg-emerald-600 px-7 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-500 hover:shadow-emerald-500/25"
              >
                Start free
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onSignIn}
                className="h-12 rounded-full px-7 text-base font-semibold hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:text-emerald-700 dark:hover:text-emerald-300"
              >
                Sign in
              </Button>
            </div>
          </StaggerItem>

          <StaggerItem>
            <p className="mt-5 text-sm text-muted-foreground">
              No credit card required · 14-day free trial
            </p>
          </StaggerItem>
        </StaggerGroup>

        {/* Product mockup */}
        <motion.div
          className="relative mx-auto mt-14 max-w-5xl sm:mt-20"
          initial={reduce ? false : { opacity: 0, y: 48, scale: 0.97 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
        >
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-emerald-950/10 dark:shadow-black/40">
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-3">
              <span className="size-2.5 rounded-full bg-rose-400" aria-hidden="true" />
              <span className="size-2.5 rounded-full bg-amber-400" aria-hidden="true" />
              <span className="size-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
              <div className="mx-auto flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1 text-[11px] text-muted-foreground">
                <Lock className="size-3" aria-hidden="true" />
                app.novacrm.com
              </div>
              <span className="w-10" aria-hidden="true" />
            </div>
            <DashboardMockup />
          </div>

          {/* Floating glass stat chips */}
          {FLOATING_CHIPS.map((chip) => (
            <motion.div
              key={chip.label}
              className={`absolute ${chip.position} hidden sm:block`}
              initial={reduce ? false : { opacity: 0, scale: 0.85, y: 12 }}
              whileInView={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.45 }}
            >
              <motion.div
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/85 px-4 py-3 shadow-lg shadow-emerald-950/10 backdrop-blur-md dark:shadow-black/30"
                animate={reduce ? undefined : { y: [0, -9, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: chip.delay }}
              >
                <span className={`flex size-9 items-center justify-center rounded-xl ${chip.iconClass}`}>
                  <chip.icon className="size-[18px]" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{chip.label}</span>
                  <span className="block text-xs text-muted-foreground">{chip.sub}</span>
                </span>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Landing composition                                                 */
/* ------------------------------------------------------------------ */

export default function Landing({ onSignIn, onSignUp }: LandingProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-emerald-500/60"
      >
        Skip to content
      </a>
      <Header onSignIn={onSignIn} onSignUp={onSignUp} />
      <main id="main">
        <Hero onSignIn={onSignIn} onSignUp={onSignUp} />
        <TrustedBy />
        <StatsBand />
        <FeaturesSection />
        <AutomationSection />
        <IntegrationsSection />
        <PricingSection onSignUp={onSignUp} />
        <TestimonialsSection />
        <FaqSection />
        <FinalCta onSignUp={onSignUp} />
      </main>
      <Footer />
    </ThemeProvider>
  )
}
