'use client'

import * as React from 'react'
import { ThemeProvider } from 'next-themes'

import { Toaster } from '@/components/ui/sonner'
import { api, getActiveOrgId, setActiveOrgId, type SessionPayload, type SessionUser, type MembershipInfo, type OrgInfo } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'

import Landing from '@/components/crm/landing'
import { AuthView } from '@/components/crm/AuthView'
import { Workspace } from '@/components/crm/Workspace'
import { ErrorBoundary } from '@/components/crm/ErrorBoundary'
import { LogoMark } from '@/components/crm/landing/illustrations'

type AppSession = {
  user: SessionUser
  memberships: MembershipInfo[]
  activeOrgId: string
}

export default function Page() {
  const [booted, setBooted] = React.useState(false)
  const [session, setSession] = React.useState<AppSession | null>(null)
  const [view, setView] = React.useState<'landing' | 'auth'>('landing')
  const [authMode, setAuthMode] = React.useState<'signin' | 'signup'>('signup')
  const bump = useWorkspace((s) => s.bump)

  // Boot: restore session
  React.useEffect(() => {
    let alive = true
    api<SessionPayload>('/api/auth/me')
      .then((payload) => {
        if (!alive) return
        if (payload.user && payload.memberships?.length) {
          setSession({ user: payload.user, memberships: payload.memberships, activeOrgId: payload.activeOrgId ?? payload.memberships[0].org.id })
          const stored = getActiveOrgId()
          if (!stored || stored !== (payload.activeOrgId ?? '')) setActiveOrgId(payload.activeOrgId ?? payload.memberships[0].org.id)
        } else {
          setSession(null)
        }
      })
      .catch(() => alive && setSession(null))
      .finally(() => alive && setBooted(true))

    // Surface any stray unhandled rejection as a calm toast instead of silence.
    const onReject = (e: PromiseRejectionEvent) => {
      console.warn('[unhandled rejection]', e.reason)
    }
    window.addEventListener('unhandledrejection', onReject)
    return () => {
      alive = false
      window.removeEventListener('unhandledrejection', onReject)
    }
  }, [])

  const handleAuthSuccess = (payload: SessionPayload & { user: SessionUser }) => {
    const activeOrgId = payload.activeOrgId ?? payload.memberships?.[0]?.org.id ?? ''
    // Always pin the active org to the freshly authenticated account so a stale
    // value from a previous session (different account / reset database) can
    // never leak into subsequent X-Org-Id headers.
    if (activeOrgId) setActiveOrgId(activeOrgId)
    setSession({
      user: payload.user,
      memberships: payload.memberships ?? [],
      activeOrgId,
    })
    setView('landing')
    bump()
  }

  const handleSignOut = async () => {
    await api('/api/auth/signout', { method: 'POST' }).catch(() => {})
    // Drop the org pin so the next account starts from a clean slate.
    if (typeof window !== 'undefined') window.localStorage.removeItem('nova-active-org')
    setSession(null)
    setView('landing')
  }

  const handleSwitchOrg = async (orgId: string) => {
    setActiveOrgId(orgId)
    try {
      const payload = await api<SessionPayload>('/api/auth/me')
      if (payload.user && payload.memberships?.length) {
        setSession({ user: payload.user, memberships: payload.memberships, activeOrgId: orgId })
        bump()
      }
    } catch {
      /* keep current */
    }
  }

  const handleUserUpdated = (user: SessionUser) => {
    setSession((s) => (s ? { ...s, user } : s))
  }

  const handleOrgUpdated = (org: OrgInfo) => {
    setSession((s) => {
      if (!s) return s
      return {
        ...s,
        memberships: s.memberships.map((m) => (m.org.id === org.id ? { ...m, org } : m)),
      }
    })
  }

  if (!booted) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
          <span className="animate-pulse">
            <LogoMark className="h-12 w-12" />
          </span>
          <p className="text-sm text-muted-foreground">Loading Nova CRM…</p>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Toaster position="bottom-right" richColors closeButton />
      {session && session.memberships.length > 0 ? (
        (() => {
          const membership = session.memberships.find((m) => m.org.id === session.activeOrgId) ?? session.memberships[0]
          return (
            <ErrorBoundary onSignOut={handleSignOut} area="workspace">
              <Workspace
                user={session.user}
                org={membership.org}
                role={membership.role}
                memberships={session.memberships}
                onUserUpdated={handleUserUpdated}
                onOrgUpdated={handleOrgUpdated}
                onSwitchOrg={handleSwitchOrg}
                onSignOut={handleSignOut}
              />
            </ErrorBoundary>
          )
        })()
      ) : view === 'auth' ? (
        <AuthView mode={authMode} onModeChange={setAuthMode} onSuccess={handleAuthSuccess} onBack={() => setView('landing')} />
      ) : (
        <Landing
          onSignIn={() => {
            setAuthMode('signin')
            setView('auth')
          }}
          onSignUp={() => {
            setAuthMode('signup')
            setView('auth')
          }}
        />
      )}
    </ThemeProvider>
  )
}
