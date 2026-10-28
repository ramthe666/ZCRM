'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { ThemeProvider } from 'next-themes'

import { Toaster } from '@/components/ui/sonner'
import {
  api,
  ApiError,
  setActiveOrgId,
  roleLabel,
  type SessionPayload,
  type SessionUser,
  type MembershipInfo,
  type OrgInfo,
  type PendingInvitation,
  type InviteContext,
} from '@/lib/crm'
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
  pendingInvitations: PendingInvitation[]
}

const INVITE_INVALID_MSG = 'This invitation link is invalid or has expired'

/** Auth routes — served by the `/` page via next.config.ts rewrites. */
const AUTH_PATHS = new Set(['/signup', '/signin', '/login'])

/** Derive the (view, authMode) pair the URL stands for. */
function routeFromPath(pathname: string): { view: 'landing' | 'auth'; authMode: 'signin' | 'signup' } {
  if (pathname === '/signup') return { view: 'auth', authMode: 'signup' }
  if (pathname === '/signin' || pathname === '/login') return { view: 'auth', authMode: 'signin' }
  return { view: 'landing', authMode: 'signup' }
}

/** Client-side navigation that keeps the address bar in sync (no reload). */
function pushUrl(path: string) {
  try {
    window.history.pushState(null, '', path)
  } catch {
    /* best-effort */
  }
}

function replaceUrl(path: string) {
  try {
    window.history.replaceState(null, '', path)
  } catch {
    /* best-effort */
  }
}

interface PublicInviteInfo {
  invitation: {
    email: string
    role: string
    orgName: string
    inviterName: string
    expiresAt: string
    status: string
  }
}

interface AcceptInviteResponse {
  membership: { id?: string; role: string; status: string }
  org: OrgInfo
}

/** Normalize a /api/auth/me payload into app session state (pins the active org). */
function applySessionPayload(payload: SessionPayload, fallbackActive?: string): AppSession | null {
  if (!payload.user || !payload.memberships?.length) return null
  const want = fallbackActive ?? payload.activeOrgId ?? payload.memberships[0].org.id
  const activeOrgId = payload.memberships.some((m) => m.org.id === want) ? want : payload.memberships[0].org.id
  if (activeOrgId) setActiveOrgId(activeOrgId)
  return {
    user: payload.user,
    memberships: payload.memberships,
    activeOrgId,
    pendingInvitations: payload.pendingInvitations ?? [],
  }
}

export default function Page() {
  const [booted, setBooted] = React.useState(false)
  const [session, setSession] = React.useState<AppSession | null>(null)
  const [view, setView] = React.useState<'landing' | 'auth'>('landing')
  const [authMode, setAuthMode] = React.useState<'signin' | 'signup'>('signup')
  const [inviteContext, setInviteContext] = React.useState<InviteContext | null>(null)
  const bump = useWorkspace((s) => s.bump)

  // Latest session for the popstate handler (stable subscription, no re-binding).
  const sessionRef = React.useRef<AppSession | null>(null)
  React.useEffect(() => {
    sessionRef.current = session
  }, [session])

  /** Re-fetch the session (memberships + pending invitations) while keeping the current workspace. */
  const refreshSession = React.useCallback(async (keepOrgId?: string) => {
    try {
      const payload = await api<SessionPayload>('/api/auth/me')
      const next = applySessionPayload(payload, keepOrgId)
      if (next) setSession(next)
    } catch {
      /* keep the current session state */
    }
  }, [])

  /**
   * Accept an invitation for the signed-in user. 409 (already a member) counts
   * as success. The new membership is merged into the session while keeping the
   * currently active workspace.
   */
  const acceptInvite = React.useCallback(
    async (ctx: InviteContext, keepOrgId?: string): Promise<boolean> => {
      try {
        const res = await api<AcceptInviteResponse>('/api/invitations/accept', {
          method: 'POST',
          body: { token: ctx.token },
        })
        toast.success(`You've joined ${res.org?.name ?? ctx.orgName} as ${roleLabel(res.membership?.role ?? ctx.role)}`)
        if (res.org) {
          const membership: MembershipInfo = {
            role: res.membership?.role ?? ctx.role,
            status: res.membership?.status ?? 'active',
            org: res.org,
          }
          setSession((s) => {
            if (!s) return s
            const exists = s.memberships.some((m) => m.org.id === res.org.id)
            return {
              ...s,
              memberships: exists ? s.memberships.map((m) => (m.org.id === res.org.id ? membership : m)) : [...s.memberships, membership],
            }
          })
        }
        void refreshSession(keepOrgId)
        return true
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0
        if (status === 409) {
          // Already a member of the org — treat as success for the invitee.
          toast.success(`You're already part of ${ctx.orgName}`)
          void refreshSession(keepOrgId)
          return true
        }
        if (status === 403) {
          toast.error(err instanceof Error ? err.message : `This invitation was sent to ${ctx.email} — sign in with that email to accept.`)
          return false
        }
        if (status === 404 || status === 410) {
          toast.error(INVITE_INVALID_MSG)
          return false
        }
        toast.error(err instanceof Error ? err.message : 'Could not accept the invitation')
        return false
      }
    },
    [refreshSession]
  )

  // Boot: parse ?invite= deep link, restore the session, route the invitation.
  React.useEffect(() => {
    let alive = true

    // 1) Pull the invite token out of the URL before anything else.
    let inviteToken: string | null = null
    try {
      const url = new URL(window.location.href)
      inviteToken = url.searchParams.get('invite')
      if (inviteToken) {
        url.searchParams.delete('invite')
        const query = url.searchParams.toString()
        window.history.replaceState(null, '', url.pathname + (query ? `?${query}` : '') + url.hash)
      }
    } catch {
      /* best-effort URL cleanup */
    }

    const boot = async () => {
      // 2) Restore the session.
      let me: SessionPayload | null = null
      try {
        const payload = await api<SessionPayload>('/api/auth/me')
        if (payload.user && payload.memberships?.length) me = payload
      } catch {
        me = null
      }
      if (!alive) return

      // 3) Resolve the invite deep link against the public endpoint.
      let ctx: InviteContext | null = null
      const notices: { kind: 'error' | 'info'; message: string }[] = []
      if (inviteToken) {
        try {
          const res = await api<PublicInviteInfo>(`/api/invitations?token=${encodeURIComponent(inviteToken)}`)
          if (res.invitation) {
            ctx = {
              token: inviteToken,
              email: res.invitation.email,
              role: res.invitation.role,
              orgName: res.invitation.orgName,
              inviterName: res.invitation.inviterName,
            }
          } else {
            notices.push({ kind: 'error', message: INVITE_INVALID_MSG })
          }
        } catch {
          notices.push({ kind: 'error', message: INVITE_INVALID_MSG })
        }
      }
      if (!alive) return

      // 4) Apply the session (pins the active org, heals a stale pin).
      let activeOrgId: string | undefined
      if (me) {
        const next = applySessionPayload(me)
        if (next) {
          setSession(next)
          activeOrgId = next.activeOrgId
        } else {
          setSession(null)
        }
      } else {
        setSession(null)
      }

      // 5) Route to the view the URL stands for (refresh-safe /signup, /signin).
      //    A restored session wins: the workspace is the app — normalize the
      //    URL to "/" so an auth path can never linger in the address bar.
      if (me) {
        if (AUTH_PATHS.has(window.location.pathname)) replaceUrl('/')
      } else {
        const r = routeFromPath(window.location.pathname)
        setView(r.view)
        setAuthMode(r.authMode)
        if (ctx) {
          // Invite deep link + signed out → the invitation-aware sign-in screen.
          setInviteContext(ctx)
          setAuthMode('signin')
          setView('auth')
          replaceUrl('/signin')
        }
      }

      setBooted(true)

      // Deferred notices — the <Toaster> is mounted by now.
      for (const n of notices) window.setTimeout(() => toast[n.kind](n.message), 150)

      // 6) Signed in + valid invite: accept immediately when the email matches.
      if (ctx && me) {
        const inviteCtx = ctx
        if (me.user && me.user.email.toLowerCase() === inviteCtx.email.toLowerCase()) {
          await acceptInvite(inviteCtx, activeOrgId)
        } else {
          window.setTimeout(
            () => toast.info(`This invitation was sent to ${inviteCtx.email} — sign in with that email to accept.`),
            150
          )
        }
      }
    }

    void boot()

    // Surface any stray unhandled rejection as a calm log instead of silence.
    const onReject = (e: PromiseRejectionEvent) => {
      console.warn('[unhandled rejection]', e.reason)
    }
    window.addEventListener('unhandledrejection', onReject)
    return () => {
      alive = false
      window.removeEventListener('unhandledrejection', onReject)
    }
  }, [acceptInvite])

  // Browser back/forward re-routes the app from the URL (auth screens ↔
  // landing). While signed in, the workspace is the app — the URL stays at "/".
  React.useEffect(() => {
    if (!booted) return
    const onPop = () => {
      if (sessionRef.current) {
        if (AUTH_PATHS.has(window.location.pathname)) replaceUrl('/')
        return
      }
      const r = routeFromPath(window.location.pathname)
      setView(r.view)
      setAuthMode(r.authMode)
      if (r.view === 'landing') setInviteContext(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [booted])

  const handleAuthSuccess = async (payload: SessionPayload & { user: SessionUser }) => {
    const activeOrgId = payload.activeOrgId ?? payload.memberships?.[0]?.org.id ?? ''
    // Always pin the active org to the freshly authenticated account so a stale
    // value from a previous session (different account / reset database) can
    // never leak into subsequent X-Org-Id headers.
    if (activeOrgId) setActiveOrgId(activeOrgId)
    setSession({
      user: payload.user,
      memberships: payload.memberships ?? [],
      activeOrgId,
      pendingInvitations: payload.pendingInvitations ?? [],
    })
    setView('landing')
    pushUrl('/')
    bump()

    // Invitation flow: accept the pending deep-link invite with the fresh
    // session. Signup auto-accepts server-side, so a 409 here is a success.
    const ctx = inviteContext
    if (ctx) {
      setInviteContext(null)
      if (payload.user.email.toLowerCase() === ctx.email.toLowerCase()) {
        await acceptInvite(ctx, activeOrgId)
      } else {
        toast.error(`This invitation was sent to ${ctx.email} — sign in with that email to accept.`)
      }
    }
  }

  const handleSignOut = async () => {
    await api('/api/auth/signout', { method: 'POST' }).catch(() => {})
    // Drop the org pin so the next account starts from a clean slate.
    if (typeof window !== 'undefined') window.localStorage.removeItem('nova-active-org')
    setSession(null)
    setView('landing')
    pushUrl('/')
  }

  /** Demo banner: leave the shared workspace and create your own. */
  const handleStartTrial = async () => {
    await api('/api/auth/signout', { method: 'POST' }).catch(() => {})
    if (typeof window !== 'undefined') window.localStorage.removeItem('nova-active-org')
    setSession(null)
    setInviteContext(null)
    setAuthMode('signup')
    setView('auth')
    pushUrl('/signup')
  }

  const handleSwitchOrg = async (orgId: string) => {
    setActiveOrgId(orgId)
    try {
      const payload = await api<SessionPayload>('/api/auth/me')
      const next = applySessionPayload(payload, orgId)
      if (next) {
        setSession(next)
        bump()
      }
    } catch {
      /* keep current */
    }
  }

  /** Join banner: accept a pending invitation surfaced by /api/auth/me. */
  const handleAcceptInvite = async (token: string) => {
    const pending = session?.pendingInvitations.find((p) => p.token === token)
    if (!pending || !session) return
    await acceptInvite(
      {
        token,
        email: session.user.email,
        role: pending.role,
        orgName: pending.orgName,
        inviterName: pending.inviterName,
      },
      session.activeOrgId
    )
  }

  /** Join banner: dismiss (decline) a pending invitation. */
  const handleDeclineInvite = async (token: string) => {
    try {
      await api('/api/invitations/decline', { method: 'POST', body: { token } })
      toast.info('Invitation declined')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not decline the invitation')
    }
    await refreshSession(session?.activeOrgId)
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
        <Toaster position="bottom-right" richColors closeButton />
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
                pendingInvitations={session.pendingInvitations}
                onUserUpdated={handleUserUpdated}
                onOrgUpdated={handleOrgUpdated}
                onSwitchOrg={handleSwitchOrg}
                onSignOut={handleSignOut}
                onAcceptInvite={(token) => void handleAcceptInvite(token)}
                onDeclineInvite={(token) => void handleDeclineInvite(token)}
                onStartTrial={() => void handleStartTrial()}
              />
            </ErrorBoundary>
          )
        })()
      ) : view === 'auth' ? (
        <AuthView
          mode={authMode}
          onModeChange={(m) => {
            setAuthMode(m)
            // Same logical screen — replace, so Back still returns to the landing.
            replaceUrl(m === 'signup' ? '/signup' : '/signin')
          }}
          onSuccess={handleAuthSuccess}
          onBack={() => {
            setInviteContext(null)
            setView('landing')
            pushUrl('/')
          }}
          invite={inviteContext}
        />
      ) : (
        <Landing
          onSignIn={() => {
            setAuthMode('signin')
            setView('auth')
            pushUrl('/signin')
          }}
          onSignUp={() => {
            setAuthMode('signup')
            setView('auth')
            pushUrl('/signup')
          }}
        />
      )}
    </ThemeProvider>
  )
}
