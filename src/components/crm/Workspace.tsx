'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  Menu, Search, Bell, Sun, Moon, LogOut, ChevronsUpDown, Building2, Check,
  Command as CommandIcon, Clock, UserRound, MailPlus, FlaskConical, Sparkles, RotateCw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'

import { api, MODULE_GROUPS, ALL_MODULES, moduleAllowedForRole, isDemoOrg, roleLabel, formatRelative, initials, type Row, type SessionUser, type MembershipInfo, type OrgInfo, type PendingInvitation } from '@/lib/crm'
import { getActiveOrgId, setActiveOrgId } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'

import { LogoMark } from '@/components/crm/landing/illustrations'
import { ConfirmDialog } from './shared'
import { DashboardView } from './views/DashboardView'
import { EntityView } from './views/EntityView'
import { DealsView } from './views/DealsView'
import { CalendarView } from './views/CalendarView'
import { ActivitiesView } from './views/ActivitiesView'
import { CampaignsView } from './views/CampaignsView'
import { WorkflowsView } from './views/WorkflowsView'
import { ReportsView } from './views/ReportsView'
import { TeamView } from './views/TeamView'
import { IntegrationsView } from './views/IntegrationsView'
import { BillingView } from './views/BillingView'
import { SettingsView } from './views/SettingsView'

export interface WorkspaceProps {
  user: SessionUser
  org: OrgInfo
  role: string
  memberships: MembershipInfo[]
  /** Open invitations for the signed-in user's email (join banners). */
  pendingInvitations?: PendingInvitation[]
  onUserUpdated: (u: SessionUser) => void
  onOrgUpdated: (o: OrgInfo) => void
  onSwitchOrg: (orgId: string) => void
  onSignOut: () => void
  onAcceptInvite?: (token: string) => void
  onDeclineInvite?: (token: string) => void
  /** Demo banner: sign out and start a fresh signup (own workspace). */
  onStartTrial?: () => void
}

export function Workspace(props: WorkspaceProps) {
  const { user, org, role, memberships, onSignOut } = props
  const store = useWorkspace()
  const setModule = useWorkspace((s) => s.setModule)
  const [mobileNav, setMobileNav] = React.useState(false)
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [seats, setSeats] = React.useState(memberships.length ? 0 : 0)

  // Role-gated navigation (mirrors the server-enforced module permissions).
  const navGroups = React.useMemo(
    () =>
      MODULE_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => moduleAllowedForRole(item.key, role)),
      })).filter((group) => group.items.length > 0),
    [role]
  )

  // Defensive: if the active module is unavailable for this role (e.g. the role
  // just changed server-side), bounce back to the dashboard.
  React.useEffect(() => {
    if (!moduleAllowedForRole(store.module, role)) setModule('dashboard')
  }, [store.module, role, setModule])

  // Keyboard shortcut ⌘K / Ctrl+K
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  React.useEffect(() => {
    void api<{ rows: Row[] }>('/api/org/members').then((r) => setSeats(r.rows.length)).catch(() => {})
  }, [store.refreshTick])

  const renderModule = () => {
    // Role gate: never render a module the current role can't access.
    if (!moduleAllowedForRole(store.module, role)) {
      return <DashboardView userName={user.name} />
    }
    switch (store.module) {
      case 'dashboard':
        return <DashboardView userName={user.name} />
      case 'deals':
        return <DealsView role={role} />
      case 'calendar':
        return <CalendarView />
      case 'activities':
        return <ActivitiesView />
      case 'campaigns':
        return <CampaignsView role={role} />
      case 'workflows':
        return <WorkflowsView role={role} />
      case 'reports':
        return <ReportsView />
      case 'team':
        return <TeamView role={role} plan={org.plan} seatsUsed={seats} />
      case 'integrations':
        return <IntegrationsView role={role} />
      case 'billing':
        return <BillingView role={role} />
      case 'settings':
        return (
          <SettingsView
            user={user}
            org={org}
            role={role}
            onUserUpdated={props.onUserUpdated}
            onOrgUpdated={props.onOrgUpdated}
          />
        )
      default:
        return <EntityView entity={store.module} role={role} />
    }
  }

  const nav = (
    <nav aria-label="Main navigation" className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <LogoMark className="h-8 w-8 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">Nova CRM</p>
          <p className="truncate text-xs text-muted-foreground">{org.name}</p>
        </div>
        <Badge variant="outline" className="ml-auto shrink-0 border-emerald-500/40 text-emerald-700 capitalize dark:text-emerald-400">
          {org.plan}
        </Badge>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 pb-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon
              const active = store.module === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    store.setModule(item.key)
                    setMobileNav(false)
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                    active
                      ? 'bg-emerald-500/12 font-medium text-emerald-700 dark:text-emerald-300'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}
      </ScrollArea>

      <div className="border-t p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: user.avatarColor }}>
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{user.name}</p>
            <p className="truncate text-xs capitalize text-muted-foreground">{role}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSignOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-background lg:block">{nav}</aside>

      {/* Mobile nav */}
      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {nav}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>

          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 flex-1 items-center gap-2 rounded-lg border bg-muted/50 px-3 text-sm text-muted-foreground transition hover:border-emerald-500/50 sm:max-w-md"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search leads, contacts, deals…</span>
            <kbd className="hidden items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:flex">
              <CommandIcon className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            {memberships.length > 1 ? <OrgSwitcher memberships={memberships} activeOrgId={org.id} onSwitch={props.onSwitchOrg} /> : null}
            <NotificationsBell />
            <ThemeToggle />
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {/* Pending invitations — newest first, stacked (max 3) */}
          {props.pendingInvitations && props.pendingInvitations.length > 0 && props.onAcceptInvite && props.onDeclineInvite ? (
            <InviteBanner invitations={props.pendingInvitations} onAccept={props.onAcceptInvite} onDecline={props.onDeclineInvite} />
          ) : null}

          {/* Shared demo workspace notice */}
          {isDemoOrg(org) && props.onStartTrial ? <DemoBanner role={role} onStartTrial={props.onStartTrial} /> : null}

          <AnimatePresence mode="wait">
            <motion.div key={store.module} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              {renderModule()}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="mt-auto border-t bg-background px-6 py-3 text-xs text-muted-foreground">
          Nova CRM · {org.name} · Signed in as {user.email}
        </footer>
      </div>

      <SearchPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={role} />
    </div>
  )
}

// ─────────────────────────── Pending invitation banner ───────────────────────────

function InviteBanner({
  invitations,
  onAccept,
  onDecline,
}: {
  invitations: PendingInvitation[]
  onAccept: (token: string) => void
  onDecline: (token: string) => void
}) {
  const visible = invitations.slice(0, 3)
  const extra = invitations.length - visible.length
  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10">
      <AnimatePresence initial={false}>
        {visible.map((inv) => (
          <motion.div
            key={inv.token}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2.5 px-4 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
                <MailPlus className="h-5 w-5" />
              </span>
              <p className="min-w-0 flex-1 text-sm text-emerald-900 dark:text-emerald-100">
                <span className="font-semibold">{inv.inviterName}</span> invited you to join{' '}
                <span className="font-semibold">{inv.orgName}</span> as {roleLabel(inv.role)}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  className="h-11 bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                  onClick={() => onAccept(inv.token)}
                >
                  <Check className="mr-1.5 h-4 w-4" /> Accept
                </Button>
                <Button
                  variant="ghost"
                  className="h-11 px-4 text-emerald-800 hover:bg-emerald-600/10 hover:text-emerald-900 dark:text-emerald-200 dark:hover:text-emerald-100"
                  onClick={() => onDecline(inv.token)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {extra > 0 ? (
        <p className="border-t border-emerald-200/70 px-4 py-1.5 text-xs text-emerald-800/80 dark:border-emerald-500/20 dark:text-emerald-200/70">
          +{extra} more invitation{extra === 1 ? '' : 's'} waiting
        </p>
      ) : null}
    </div>
  )
}

// ─────────────────────────── Demo workspace banner ───────────────────────────

function DemoBanner({ role, onStartTrial }: { role: string; onStartTrial: () => void }) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const bump = useWorkspace((s) => s.bump)
  const isAdmin = role === 'admin' || role === 'owner'

  const resetDemo = async () => {
    await api('/api/demo/reset', { method: 'POST' })
    toast.success('Demo data reset ✨')
    bump()
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-500/25 dark:bg-amber-500/10"
        role="note"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
          <FlaskConical className="h-5 w-5" />
        </span>
        <p className="min-w-0 flex-1 text-sm text-amber-900 dark:text-amber-100">
          You&apos;re exploring the shared demo workspace — sample data, visible to everyone, resets periodically.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button className="h-11 bg-amber-600 px-4 text-white hover:bg-amber-700" onClick={onStartTrial}>
            <Sparkles className="mr-1.5 h-4 w-4" /> Create your own workspace
          </Button>
          {isAdmin ? (
            <Button
              variant="ghost"
              className="h-11 px-4 text-amber-800 hover:bg-amber-600/10 hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-100"
              onClick={() => setConfirmOpen(true)}
            >
              <RotateCw className="mr-1.5 h-4 w-4" /> Reset demo data
            </Button>
          ) : null}
        </div>
      </motion.div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={resetDemo}
        title="Reset demo data?"
        description="All exploratory changes in the shared demo workspace are replaced with the original sample dataset. This affects everyone currently using the demo."
        confirmLabel="Reset demo data"
        destructive={false}
      />
    </>
  )
}

// ─────────────────────────── Theme ───────────────────────────

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
    </Button>
  )
}

// ─────────────────────────── Org switcher ───────────────────────────

function OrgSwitcher({ memberships, activeOrgId, onSwitch }: { memberships: MembershipInfo[]; activeOrgId: string; onSwitch: (id: string) => void }) {
  const active = memberships.find((m) => m.org.id === activeOrgId) ?? memberships[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 max-w-[180px] gap-1.5">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="truncate">{active.org.name}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {memberships.map((m) => (
          <DropdownMenuItem key={m.org.id} onClick={() => onSwitch(m.org.id)} className="gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 truncate">{m.org.name}</span>
            {m.org.id === activeOrgId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─────────────────────────── Notifications ───────────────────────────

const NOTIF_TONE: Record<string, string> = {
  info: 'bg-teal-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  deal: 'bg-orange-500',
  task: 'bg-rose-500',
  team: 'bg-teal-500',
  billing: 'bg-emerald-500',
}

function NotificationsBell() {
  const [rows, setRows] = React.useState<Row[]>([])
  const [unread, setUnread] = React.useState(0)
  const [open, setOpen] = React.useState(false)
  const refreshTick = useWorkspace((s) => s.refreshTick)

  const load = React.useCallback(async () => {
    try {
      const res = await api<{ rows: Row[]; unreadCount: number }>('/api/notifications')
      setRows(res.rows)
      setUnread(res.unreadCount)
    } catch {
      /* ignore */
    }
  }, [])

  React.useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 30000)
    return () => clearInterval(t)
  }, [load, refreshTick])

  const markAll = async () => {
    await api('/api/notifications', { method: 'PATCH', body: { all: true } }).catch(() => {})
    void load()
  }

  const markOne = async (id: string) => {
    await api('/api/notifications', { method: 'PATCH', body: { id } }).catch(() => {})
    void load()
  }

  return (
    <DropdownMenu open={open} onOpenChange={(o) => { setOpen(o); if (o) void load() }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unread} unread)`}>
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" className="h-6 text-xs text-emerald-700 dark:text-emerald-400" onClick={markAll}>
              Mark all read
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {rows.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up 🎉</p>
        ) : (
          <ScrollArea className="max-h-96">
            {rows.map((n) => (
              <button
                key={String(n.id)}
                onClick={() => markOne(String(n.id))}
                className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-muted ${n.read ? 'opacity-60' : ''}`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${NOTIF_TONE[String(n.type)] ?? 'bg-muted-foreground'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{String(n.title)}</span>
                  {n.body ? <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{String(n.body)}</span> : null}
                  <span className="mt-1 block text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─────────────────────────── Command palette ───────────────────────────

interface SearchGroup {
  key: string
  label: string
  items: { id: string; title: string; subtitle: string; entity: string }[]
}

function SearchPalette({ open, onOpenChange, role }: { open: boolean; onOpenChange: (o: boolean) => void; role: string }) {
  const [q, setQ] = React.useState('')
  const [groups, setGroups] = React.useState<SearchGroup[]>([])
  const [searching, setSearching] = React.useState(false)
  const store = useWorkspace()

  const quickNav = React.useMemo(() => ALL_MODULES.filter((m) => moduleAllowedForRole(m.key, role)), [role])

  React.useEffect(() => {
    if (!open) {
      setQ('')
      setGroups([])
    }
  }, [open])

  React.useEffect(() => {
    if (q.trim().length < 2) {
      setGroups([])
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await api<{ groups: SearchGroup[] }>(`/api/search?q=${encodeURIComponent(q.trim())}`)
        setGroups(res.groups ?? [])
      } catch {
        setGroups([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput value={q} onValueChange={setQ} placeholder="Search leads, contacts, accounts, deals, tasks…" />
      <CommandList>
        <CommandEmpty>{searching ? 'Searching…' : q.length >= 2 ? 'No results found.' : 'Type at least 2 characters to search.'}</CommandEmpty>

        {q.trim().length < 2 ? (
          <CommandGroup heading="Quick navigation">
            {quickNav.map((m) => (
              <CommandItem
                key={m.key}
                value={`go ${m.label}`}
                onSelect={() => {
                  store.setModule(m.key)
                  onOpenChange(false)
                }}
              >
                <m.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                Go to {m.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {groups.map((g) => (
          <CommandGroup key={g.key} heading={g.label}>
            {g.items.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.title} ${item.subtitle}`}
                onSelect={() => {
                  store.openRecordIn(item.entity, item.id)
                  onOpenChange(false)
                }}
              >
                <UserRound className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{item.title}</span>
                <span className="ml-2 truncate text-xs text-muted-foreground">{item.subtitle}</span>
                <Clock className="ml-auto h-3 w-3 text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {groups.length > 0 ? <CommandSeparator /> : null}
      </CommandList>
    </CommandDialog>
  )
}
