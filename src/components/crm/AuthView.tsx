'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, Sparkles, Lock, Mail, MailPlus, UserRound, Building2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

import { api, ApiError, setActiveOrgId, roleLabel, type SessionPayload } from '@/lib/crm'
import { LogoMark, DashboardMockup } from '@/components/crm/landing/illustrations'

export interface AuthInvite {
  email: string
  role: string
  orgName: string
  inviterName: string
}

export function AuthView({
  mode,
  onModeChange,
  onSuccess,
  onBack,
  invite,
}: {
  mode: 'signin' | 'signup'
  onModeChange: (m: 'signin' | 'signup') => void
  onSuccess: (payload: SessionPayload & { user: NonNullable<SessionPayload['user']> }) => void
  onBack: () => void
  /** Present when the user arrived via an invitation deep link. */
  invite?: AuthInvite | null
}) {
  const [name, setName] = React.useState('')
  const [company, setCompany] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [errorHint, setErrorHint] = React.useState<string | null>(null)

  // Deep-link invitations pin the invitee's email — prefill it once.
  React.useEffect(() => {
    if (invite?.email) setEmail(invite.email)
  }, [invite?.email])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setErrorHint(null)
    setBusy(true)
    try {
      const payload =
        mode === 'signin'
          ? await api<SessionPayload & { user: NonNullable<SessionPayload['user']> }>('/api/auth/signin', { method: 'POST', body: { email, password } })
          : await api<SessionPayload & { user: NonNullable<SessionPayload['user']> }>('/api/auth/signup', { method: 'POST', body: { name, email, password, companyName: company } })
      if (payload.activeOrgId) setActiveOrgId(payload.activeOrgId)
      toast.success(mode === 'signin' ? `Welcome back, ${payload.user.name.split(' ')[0]}!` : 'Workspace created — welcome aboard! 🎉')
      onSuccess(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setErrorHint(err instanceof ApiError ? (err.hint ?? null) : null)
    } finally {
      setBusy(false)
    }
  }

  const fillDemo = () => {
    setMode('signin')
    setEmail('demo@novacrm.io')
    setPassword('Demo1234!')
    toast.info('Demo credentials filled — press Sign in')
  }

  const setMode = (m: 'signin' | 'signup') => {
    onModeChange(m)
    setError(null)
    setErrorHint(null)
    if (invite?.email) setEmail(invite.email)
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-emerald-950 p-10 text-emerald-50 lg:flex">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />
        </div>
        <div className="relative flex items-center gap-2.5">
          <LogoMark className="h-9 w-9" />
          <span className="text-lg font-bold">Nova CRM</span>
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative">
          <h1 className="max-w-md text-3xl font-bold leading-tight">
            One workspace for every lead, deal and customer conversation.
          </h1>
          <p className="mt-3 max-w-md text-sm text-emerald-200/80">
            Pipelines, automation, campaigns, WhatsApp and analytics — with enterprise-grade row-level security from day one.
          </p>
          <DashboardMockup className="mt-8 h-auto w-full max-w-lg opacity-90" />
        </motion.div>
        <p className="relative text-xs text-emerald-200/60">© 2025 Nova CRM · SOC 2-ready architecture · Supabase + Vercel compatible</p>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col items-center justify-center px-4 py-10 lg:w-1/2">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="w-full max-w-md">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground" onClick={onBack}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to home
          </Button>

          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <LogoMark className="h-8 w-8" />
            <span className="font-bold">Nova CRM</span>
          </div>

          {invite ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              role="status"
              className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:border-emerald-500/30 dark:from-emerald-500/10 dark:to-teal-500/10"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
                  <MailPlus className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">
                    You&apos;ve been invited to join {invite.orgName}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                    as
                    <Badge className="border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      {roleLabel(invite.role)}
                    </Badge>
                    <span>by {invite.inviterName}</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Accept by signing in — or create your account if you&apos;re new here.{' '}
                    <button
                      type="button"
                      className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                      onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                    >
                      {mode === 'signin' ? 'Create account' : 'Sign in instead'}
                    </button>
                  </p>
                </div>
              </div>
            </motion.div>
          ) : null}

          <h2 className="text-2xl font-bold tracking-tight">
            {invite
              ? mode === 'signin'
                ? 'Sign in to accept'
                : 'Create your account'
              : mode === 'signin'
                ? 'Welcome back'
                : 'Create your workspace'}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {invite
              ? mode === 'signin'
                ? `Use ${invite.email} to accept the invitation to ${invite.orgName}.`
                : 'Your new workspace is created first — the invitation is accepted automatically after signup.'
              : mode === 'signin'
                ? 'Sign in to your Nova CRM workspace.'
                : 'Free 14-day trial · sample data included · no credit card.'}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {mode === 'signup' ? (
              <>
                <div>
                  <Label htmlFor="name" className="mb-1.5">Your name</Label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="name" className="pl-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" required minLength={2} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="company" className="mb-1.5">Company / workspace name</Label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="company" className="pl-9" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc" required minLength={2} />
                  </div>
                </div>
              </>
            ) : null}
            <div>
              <Label htmlFor="email" className="mb-1.5">Work email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className={`pl-9 ${invite ? 'bg-muted/60 text-muted-foreground' : ''}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  readOnly={!!invite}
                  aria-readonly={!!invite}
                  aria-describedby={invite ? 'invite-email-hint' : undefined}
                />
              </div>
              {invite ? (
                <p id="invite-email-hint" className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3 shrink-0" /> Locked to the invited email — it is used to accept the invitation.
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="password" className="mb-1.5">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'} required minLength={mode === 'signup' ? 8 : 1} />
              </div>
            </div>

            {error ? (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                <p>{error}</p>
                {errorHint ? <p className="mt-1 text-xs leading-relaxed text-rose-600/90 dark:text-rose-300/80">{errorHint}</p> : null}
              </div>
            ) : null}

            <Button type="submit" disabled={busy} className="w-full bg-emerald-600 py-2.5 text-white hover:bg-emerald-700">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === 'signin' ? 'Sign in' : 'Create workspace'}
            </Button>
          </form>

          {invite ? null : (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button type="button" variant="outline" className="h-11 w-full" onClick={fillDemo}>
                <Sparkles className="mr-2 h-4 w-4 text-emerald-600" />
                Try the live demo workspace
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">demo@novacrm.io · Demo1234! · 4 team members, full sample data</p>
            </>
          )}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {mode === 'signin' ? "New to Nova CRM? " : 'Already have an account? '}
            <button type="button" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
              {mode === 'signin' ? 'Create a workspace' : 'Sign in'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
