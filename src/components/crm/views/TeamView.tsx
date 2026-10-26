'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { UserPlus, Loader2, ShieldCheck, Copy, Send, Ban, CheckCircle2, MailWarning, Clock3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { api, roleLabel, ROLE_TONE, INVITE_STATUS_TONE, formatDate, formatRelative, TONES, type Row } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'
import { PageHeader, StatusBadge, Avatar, ConfirmDialog, EmptyState } from '../shared'

// Role matrix — mirrors the server-enforced permissions (11 capabilities).
const PERMISSIONS = [
  { feature: 'View records & insights', owner: true, admin: true, manager: true, member: true },
  { feature: 'Create / edit records', owner: true, admin: true, manager: true, member: true },
  { feature: 'Delete records', owner: true, admin: true, manager: true, member: false },
  { feature: 'Import / export data', owner: true, admin: true, manager: true, member: false },
  { feature: 'Campaigns', owner: true, admin: true, manager: true, member: false },
  { feature: 'Workflows', owner: true, admin: true, manager: true, member: false },
  { feature: 'Team management', owner: true, admin: true, manager: false, member: false },
  { feature: 'Integrations', owner: true, admin: true, manager: false, member: false },
  { feature: 'Workspace settings', owner: true, admin: true, manager: false, member: false },
  { feature: 'Billing', owner: true, admin: true, manager: false, member: false },
  { feature: 'Audit log', owner: true, admin: true, manager: false, member: false },
]

interface InvitationRow {
  id: string
  email: string
  role: string
  status: string
  createdAt: string
  expiresAt: string
  invitedByName?: string | null
}

interface InviteResponse {
  invitation: { id: string; email: string; role: string; status: string; expiresAt: string }
  emailSent: boolean
  inviteToken: string
}

function inviteLinkFor(token: string): string {
  return `${window.location.origin}/?invite=${token}`
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function invitationStatus(inv: InvitationRow): { key: string; label: string } {
  if (inv.status === 'pending' && new Date(inv.expiresAt).getTime() < Date.now()) {
    return { key: 'expired', label: 'Expired' }
  }
  const label = inv.status.charAt(0).toUpperCase() + inv.status.slice(1)
  return { key: inv.status, label }
}

export function TeamView({ role, plan, seatsUsed }: { role: string; plan: string; seatsUsed: number }) {
  const store = useWorkspace()
  const [rows, setRows] = React.useState<Row[]>([])
  const [invitations, setInvitations] = React.useState<InvitationRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [inviteRole, setInviteRole] = React.useState('member')
  const [busy, setBusy] = React.useState(false)
  const [inviteResult, setInviteResult] = React.useState<{ email: string; emailSent: boolean; link: string } | null>(null)
  const [removing, setRemoving] = React.useState<Row | null>(null)
  const [revoking, setRevoking] = React.useState<InvitationRow | null>(null)
  const [actionBusy, setActionBusy] = React.useState<string | null>(null)

  const isAdmin = ['admin', 'owner'].includes(role)

  const fetchTeam = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ rows: Row[] }>('/api/org/members')
      setRows(res.rows)
    } catch {
      toast.error('Failed to load team')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchInvitations = React.useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await api<{ rows: InvitationRow[] }>('/api/org/invitations')
      setInvitations(res.rows ?? [])
    } catch {
      /* invitations are auxiliary — never block the team table on them */
    }
  }, [isAdmin])

  React.useEffect(() => {
    void fetchTeam()
  }, [fetchTeam, store.refreshTick])

  React.useEffect(() => {
    void fetchInvitations()
  }, [fetchInvitations, store.refreshTick])

  const invite = async () => {
    setBusy(true)
    try {
      const res = await api<InviteResponse>('/api/org/members', {
        method: 'POST',
        body: { email, role: inviteRole },
      })
      setInviteResult({ email, emailSent: !!res.emailSent, link: inviteLinkFor(res.inviteToken) })
      setEmail('')
      store.bump()
      void fetchTeam()
      void fetchInvitations()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setBusy(false)
    }
  }

  const closeInviteDialog = () => {
    setInviteOpen(false)
    setInviteResult(null)
    setEmail('')
  }

  const resendInvitation = async (inv: InvitationRow, intent: 'copy' | 'resend') => {
    setActionBusy(`${inv.id}:${intent}`)
    try {
      const res = await api<InviteResponse>('/api/org/invitations', { method: 'POST', body: { id: inv.id } })
      const link = inviteLinkFor(res.inviteToken)
      if (intent === 'copy') {
        const ok = await copyToClipboard(link)
        if (ok) toast.success('Invite link copied to clipboard')
        else toast.error('Could not copy the link — please copy it manually')
      } else if (res.emailSent) {
        toast.success('Invitation resent 📨')
      } else {
        const ok = await copyToClipboard(link)
        if (ok) toast.info('Email delivery isn\u2019t connected — invite link copied instead')
        else toast.error('Email delivery isn\u2019t connected and the link could not be copied')
      }
      void fetchInvitations()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resend invitation')
    } finally {
      setActionBusy(null)
    }
  }

  const changeRole = async (m: Row, newRole: string) => {
    try {
      await api(`/api/org/members/${String(m.id)}`, { method: 'PATCH', body: { role: newRole } })
      toast.success(`${String((m.user as Row).name)} is now ${roleLabel(newRole)}`)
      void fetchTeam()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change role')
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <PageHeader title="Team" description={`Manage who has access to this workspace. ${seatsUsed} seat${seatsUsed === 1 ? '' : 's'} in use on the ${plan} plan.`}>
        {isAdmin ? (
          <Button
            className="h-11 bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => {
              setInviteResult(null)
              setInviteOpen(true)
            }}
          >
            <UserPlus className="mr-1.5 h-4 w-4" /> Invite member
          </Button>
        ) : null}
      </PageHeader>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="overflow-hidden rounded-2xl border bg-card lg:col-span-2">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Joined</TableHead>
                    {isAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((m) => {
                    const user = m.user as Row
                    return (
                      <TableRow key={String(m.id)}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={String(user.name)} color={String(user.avatarColor)} />
                            <div>
                              <p className="font-medium">{String(user.name)}</p>
                              <p className="text-xs text-muted-foreground">{String(user.email)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isAdmin && m.role !== 'owner' ? (
                            <Select value={String(m.role)} onValueChange={(v) => changeRole(m, v)}>
                              <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {['admin', 'manager', 'member'].map((r) => (
                                  <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <StatusBadge label={roleLabel(String(m.role))} tone={ROLE_TONE[String(m.role)]} />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.status === 'active' ? 'default' : 'secondary'} className={m.status === 'active' ? 'bg-emerald-600' : ''}>
                            {String(m.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{formatDate(m.createdAt)}</TableCell>
                        {isAdmin ? (
                          <TableCell className="text-right">
                            {m.role !== 'owner' ? (
                              <Button variant="outline" size="sm" className="h-11 text-rose-600 hover:text-rose-700" onClick={() => setRemoving(m)}>
                                Remove
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Owner</span>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-2xl border bg-card p-5">
              <h3 className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Role permissions
              </h3>
              <div className="mt-4 space-y-2.5 text-sm">
                {PERMISSIONS.map((p) => (
                  <div key={p.feature} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{p.feature}</span>
                    <span className="flex gap-1">
                      {(['owner', 'admin', 'manager', 'member'] as const).map((r) => (
                        <span
                          key={r}
                          title={roleLabel(r)}
                          aria-label={`${p.feature} — ${roleLabel(r)}: ${p[r] ? 'allowed' : 'not allowed'}`}
                          className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${
                            p[r] ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground/40'
                          }`}
                        >
                          {p[r] ? roleLabel(r)[0] : '✕'}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Members can only delete records assigned to them. Roles are enforced server-side on every API request — Row
                Level Security (Supabase) adds a second enforcement layer in production.
              </p>
            </div>
          </div>

          {isAdmin ? (
            <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-5 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Send className="h-4 w-4 text-emerald-600" /> Pending &amp; past invitations
                </h3>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  Invitations expire after 7 days. Members see a join banner when they sign in.
                </p>
              </div>
              {invitations.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="No invitations yet"
                    description="Invite a teammate by email — they'll receive a secure link to join this workspace."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Invitee</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Sent</TableHead>
                      <TableHead className="hidden lg:table-cell">Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((inv) => {
                      const status = invitationStatus(inv)
                      const active = status.key === 'pending'
                      return (
                        <TableRow key={inv.id} className={active ? '' : 'opacity-70'}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <span
                                aria-hidden
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  status.key === 'pending'
                                    ? 'bg-amber-500'
                                    : status.key === 'accepted'
                                      ? 'bg-emerald-500'
                                      : 'bg-muted-foreground/40'
                                }`}
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{inv.email}</p>
                                {inv.invitedByName ? (
                                  <p className="truncate text-xs text-muted-foreground">by {inv.invitedByName}</p>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge label={roleLabel(inv.role)} tone={ROLE_TONE[inv.role]} />
                          </TableCell>
                          <TableCell>
                            <Badge className={TONES[INVITE_STATUS_TONE[status.key] ?? 'slate']}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground" title={formatRelative(inv.createdAt)}>
                            {formatDate(inv.createdAt)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">{formatDate(inv.expiresAt)}</TableCell>
                          <TableCell className="text-right">
                            {active ? (
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-11"
                                  disabled={actionBusy === `${inv.id}:copy`}
                                  onClick={() => void resendInvitation(inv, 'copy')}
                                >
                                  {actionBusy === `${inv.id}:copy` ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                                  )}
                                  Copy link
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-11"
                                  disabled={actionBusy === `${inv.id}:resend`}
                                  onClick={() => void resendInvitation(inv, 'resend')}
                                >
                                  {actionBusy === `${inv.id}:resend` ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="mr-1.5 h-3.5 w-3.5" />
                                  )}
                                  Resend
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-11 text-rose-600 hover:text-rose-700"
                                  onClick={() => setRevoking(inv)}
                                >
                                  <Ban className="mr-1.5 h-3.5 w-3.5" /> Revoke
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : null}
        </>
      )}

      <Dialog open={inviteOpen} onOpenChange={(o) => !o && closeInviteDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{inviteResult ? 'Invitation ready' : 'Invite a teammate'}</DialogTitle>
            <DialogDescription>
              {inviteResult
                ? 'Share the invitation with your teammate — they can join with or without an existing account.'
                : `They'll receive a secure invitation link to join this workspace as ${roleLabel(inviteRole)}.`}
            </DialogDescription>
          </DialogHeader>

          {inviteResult ? (
            inviteResult.emailSent ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCircle2 className="h-7 w-7" />
                  </motion.span>
                  <div>
                    <p className="font-medium text-emerald-900 dark:text-emerald-100">Invitation emailed ✅</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Sent to <span className="font-medium">{inviteResult.email}</span> via Resend.
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="h-11 w-full" onClick={closeInviteDialog}>
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                    <MailWarning className="h-4 w-4 shrink-0" />
                    Resend isn&apos;t connected yet — share this secure invite link:
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Input readOnly value={inviteResult.link} className="h-11 bg-background font-mono text-xs" aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
                    <Button
                      className="h-11 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={async () => {
                        const ok = await copyToClipboard(inviteResult.link)
                        if (ok) toast.success('Invite link copied to clipboard')
                        else toast.error('Could not copy — please select the link and copy manually')
                      }}
                    >
                      <Copy className="mr-1.5 h-4 w-4" /> Copy
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-amber-800/80 dark:text-amber-200/70">
                    Connect Resend in Settings → Integrations to email invites automatically.
                  </p>
                </div>
                <Button variant="outline" className="h-11 w-full" onClick={closeInviteDialog}>
                  Done
                </Button>
              </div>
            )
          ) : (
            <>
              <div className="space-y-3">
                <div>
                  <Label className="mb-1.5" htmlFor="invite-email">Work email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="h-11"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin — manage team &amp; integrations</SelectItem>
                      <SelectItem value="manager">Manager — full records control</SelectItem>
                      <SelectItem value="member">Member — day-to-day selling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" className="h-11" onClick={closeInviteDialog}>Cancel</Button>
                <Button
                  onClick={invite}
                  disabled={busy || !email.includes('@')}
                  className="h-11 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Send invite
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          await api(`/api/org/members/${String(removing.id)}`, { method: 'DELETE' })
          toast.success('Member removed')
          void fetchTeam()
        }}
        title="Remove member?"
        description={`${removing ? String((removing.user as Row).name) : ''} will lose access to this workspace. Their owned records stay intact.`}
      />

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return
          await api(`/api/org/invitations?id=${encodeURIComponent(revoking.id)}`, { method: 'DELETE' })
          toast.success('Invitation revoked')
          void fetchInvitations()
        }}
        title="Revoke invitation?"
        description={`${revoking?.email ?? ''} will no longer be able to join this workspace with this invitation link.`}
        confirmLabel="Revoke invitation"
      />
    </motion.div>
  )
}
