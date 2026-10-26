'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { UserPlus, Loader2, ShieldCheck, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { api, roleLabel, ROLE_TONE, formatDate, type Row } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'
import { PageHeader, StatusBadge, Avatar, ConfirmDialog } from '../shared'

const PERMISSIONS = [
  { feature: 'View records', owner: true, admin: true, manager: true, member: true },
  { feature: 'Create / edit records', owner: true, admin: true, manager: true, member: true },
  { feature: 'Delete records', owner: true, admin: true, manager: true, member: false },
  { feature: 'Manage team & roles', owner: true, admin: true, manager: false, member: false },
  { feature: 'Connect integrations', owner: true, admin: true, manager: false, member: false },
  { feature: 'Manage billing & plan', owner: true, admin: false, manager: false, member: false },
]

export function TeamView({ role, plan, seatsUsed }: { role: string; plan: string; seatsUsed: number }) {
  const store = useWorkspace()
  const [rows, setRows] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(true)
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [inviteRole, setInviteRole] = React.useState('member')
  const [busy, setBusy] = React.useState(false)
  const [tempPassword, setTempPassword] = React.useState<string | null>(null)
  const [removing, setRemoving] = React.useState<Row | null>(null)

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

  React.useEffect(() => {
    void fetchTeam()
  }, [fetchTeam, store.refreshTick])

  const invite = async () => {
    setBusy(true)
    try {
      const res = await api<{ tempPassword: string | null }>('/api/org/members', {
        method: 'POST',
        body: { email, role: inviteRole },
      })
      toast.success(`Invitation created for ${email}`)
      if (res.tempPassword) setTempPassword(res.tempPassword)
      else setInviteOpen(false)
      setEmail('')
      store.bump()
      fetchTeam()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (m: Row, newRole: string) => {
    try {
      await api(`/api/org/members/${String(m.id)}`, { method: 'PATCH', body: { role: newRole } })
      toast.success(`${String((m.user as Row).name)} is now ${roleLabel(newRole)}`)
      fetchTeam()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change role')
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <PageHeader title="Team" description={`Manage who has access to this workspace. ${seatsUsed} seat${seatsUsed === 1 ? '' : 's'} in use on the ${plan} plan.`}>
        {isAdmin ? (
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { setTempPassword(null); setInviteOpen(true) }}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Invite member
          </Button>
        ) : null}
      </PageHeader>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
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
                            <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
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
                            <Button variant="outline" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => setRemoving(m)}>
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
                        className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${
                          p[r] ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground/40'
                        }`}
                      >
                        {roleLabel(r)[0]}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Roles are enforced server-side on every API request. In production, Row Level Security (Supabase) adds a second enforcement layer.
            </p>
          </div>
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={(o) => !o && setInviteOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              They get access to this workspace immediately as {roleLabel(inviteRole)}. New users receive a temporary password (delivery via Resend once connected).
            </DialogDescription>
          </DialogHeader>
          {tempPassword ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <p className="font-medium">Invitation created ✅</p>
                <p className="mt-1 text-muted-foreground">Share these sign-in credentials with your teammate:</p>
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-background p-2 font-mono text-xs">
                  <span className="flex-1 truncate">{email} · {tempPassword}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      void navigator.clipboard.writeText(`${email} / ${tempPassword}`)
                      toast.success('Credentials copied')
                    }}
                    aria-label="Copy credentials"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setInviteOpen(false)}>Done</Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div>
                  <Label className="mb-1.5">Work email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" />
                </div>
                <div>
                  <Label className="mb-1.5">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin — manage team & integrations</SelectItem>
                      <SelectItem value="manager">Manager — full records control</SelectItem>
                      <SelectItem value="member">Member — day-to-day selling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button onClick={invite} disabled={busy || !email.includes('@')} className="bg-emerald-600 text-white hover:bg-emerald-700">
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
          fetchTeam()
        }}
        title="Remove member?"
        description={`${removing ? String((removing.user as Row).name) : ''} will lose access to this workspace. Their owned records stay intact.`}
      />
    </motion.div>
  )
}
