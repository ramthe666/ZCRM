'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, Sparkles, Lock, Mail, UserRound, Building2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { api, setActiveOrgId, type SessionPayload } from '@/lib/crm'
import { LogoMark, DashboardMockup } from '@/components/crm/landing/illustrations'

export function AuthView({
  mode,
  onModeChange,
  onSuccess,
  onBack,
}: {
  mode: 'signin' | 'signup'
  onModeChange: (m: 'signin' | 'signup') => void
  onSuccess: (payload: SessionPayload & { user: NonNullable<SessionPayload['user']> }) => void
  onBack: () => void
}) {
  const [name, setName] = React.useState('')
  const [company, setCompany] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
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

          <h2 className="text-2xl font-bold tracking-tight">{mode === 'signin' ? 'Welcome back' : 'Create your workspace'}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === 'signin' ? 'Sign in to your Nova CRM workspace.' : 'Free 14-day trial · sample data included · no credit card.'}
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
                <Input id="email" type="email" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="mb-1.5">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'} required minLength={mode === 'signup' ? 8 : 1} />
              </div>
            </div>

            {error ? (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={busy} className="w-full bg-emerald-600 py-2.5 text-white hover:bg-emerald-700">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === 'signin' ? 'Sign in' : 'Create workspace'}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={fillDemo}>
            <Sparkles className="mr-2 h-4 w-4 text-emerald-600" />
            Try the live demo workspace
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">demo@novacrm.io · Demo1234! · 4 team members, full sample data</p>

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
