'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Loader2, Building2, UserRound, ScrollText, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { api, formatDate, formatDateTime, type Row, type SessionUser, type OrgInfo } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'
import { PageHeader, Avatar } from '../shared'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD', 'AUD', 'CAD']
const AVATAR_COLORS = ['#059669', '#0d9488', '#d97706', '#e11d48', '#7c3aed', '#334155', '#84cc16', '#f97316']

export function SettingsView({
  user,
  org,
  role,
  onUserUpdated,
  onOrgUpdated,
}: {
  user: SessionUser
  org: OrgInfo
  role: string
  onUserUpdated: (u: SessionUser) => void
  onOrgUpdated: (o: OrgInfo) => void
}) {
  const isAdmin = ['admin', 'owner'].includes(role)
  const canViewAudit = ['manager', 'admin', 'owner'].includes(role)

  const [orgForm, setOrgForm] = React.useState({ name: org.name, currency: org.currency, billingEmail: org.billingEmail ?? '' })
  const [orgBusy, setOrgBusy] = React.useState(false)

  const [profileForm, setProfileForm] = React.useState({ name: user.name, title: user.title ?? '', avatarColor: user.avatarColor })
  const [profileBusy, setProfileBusy] = React.useState(false)

  const [audit, setAudit] = React.useState<Row[]>([])
  const [auditTotal, setAuditTotal] = React.useState(0)
  const [auditPage, setAuditPage] = React.useState(1)
  const refreshTick = useWorkspace((s) => s.refreshTick)

  React.useEffect(() => {
    if (!canViewAudit) return
    let alive = true
    api<{ rows: Row[]; total: number }>(`/api/audit?page=${auditPage}`)
      .then((r) => {
        if (!alive) return
        setAudit(r.rows)
        setAuditTotal(r.total)
      })
      .catch(() => alive && setAudit([]))
    return () => {
      alive = false
    }
  }, [auditPage, canViewAudit, refreshTick])

  const saveOrg = async () => {
    setOrgBusy(true)
    try {
      const res = await api<{ org: Row }>('/api/org', {
        method: 'PATCH',
        body: {
          name: orgForm.name,
          currency: orgForm.currency,
          billingEmail: orgForm.billingEmail || undefined,
        },
      })
      toast.success('Workspace settings saved')
      onOrgUpdated({ ...org, name: String(res.org.name), currency: String(res.org.currency), billingEmail: (res.org.billingEmail as string) ?? null })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setOrgBusy(false)
    }
  }

  const saveProfile = async () => {
    setProfileBusy(true)
    try {
      const res = await api<{ user: SessionUser }>('/api/auth/me', {
        method: 'PATCH',
        body: { name: profileForm.name, title: profileForm.title || undefined, avatarColor: profileForm.avatarColor },
      })
      toast.success('Profile updated')
      onUserUpdated(res.user)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setProfileBusy(false)
    }
  }

  const auditPages = Math.max(1, Math.ceil(auditTotal / 30))

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <PageHeader title="Settings" description="Workspace preferences, your profile and the audit trail." />

      <Tabs defaultValue="workspace">
        <TabsList className="mb-4">
          <TabsTrigger value="workspace">
            <Building2 className="mr-1.5 h-4 w-4" /> Workspace
          </TabsTrigger>
          <TabsTrigger value="profile">
            <UserRound className="mr-1.5 h-4 w-4" /> Profile
          </TabsTrigger>
          {canViewAudit ? (
            <TabsTrigger value="audit">
              <ScrollText className="mr-1.5 h-4 w-4" /> Audit log
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="workspace">
          <div className="max-w-xl space-y-4 rounded-2xl border bg-card p-6">
            {!isAdmin ? (
              <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                Only admins and owners can change workspace settings.
              </p>
            ) : null}
            <div>
              <Label className="mb-1.5">Workspace name</Label>
              <Input value={orgForm.name} disabled={!isAdmin} onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5">Currency</Label>
                <Select value={orgForm.currency} disabled={!isAdmin} onValueChange={(v) => setOrgForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5">Billing email</Label>
                <Input type="email" value={orgForm.billingEmail} disabled={!isAdmin} placeholder="billing@company.com" onChange={(e) => setOrgForm((f) => ({ ...f, billingEmail: e.target.value }))} />
              </div>
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              Workspace ID: <span className="font-mono">{org.id}</span> · Plan:{' '}
              <span className="capitalize">{org.plan}</span> · Region data is isolated per workspace with row-level security in production.
            </div>
            {isAdmin ? (
              <Button onClick={saveOrg} disabled={orgBusy} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {orgBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save workspace
              </Button>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="profile">
          <div className="max-w-xl space-y-4 rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-4">
              <Avatar name={profileForm.name} color={profileForm.avatarColor} size={56} />
              <div>
                <p className="font-semibold">{user.email}</p>
                <p className="text-xs text-muted-foreground">Member since {formatDate(new Date().toISOString())}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5">Full name</Label>
                <Input value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5">Job title</Label>
                <Input value={profileForm.title} onChange={(e) => setProfileForm((f) => ({ ...f, title: e.target.value }))} placeholder="Account Executive" />
              </div>
            </div>
            <div>
              <Label className="mb-2">Avatar color</Label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Choose color ${c}`}
                    onClick={() => setProfileForm((f) => ({ ...f, avatarColor: c }))}
                    className={`h-8 w-8 rounded-full transition ${profileForm.avatarColor === c ? 'ring-2 ring-offset-2 ring-offset-background' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c, boxShadow: profileForm.avatarColor === c ? `0 0 0 2px ${c}` : undefined }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={saveProfile} disabled={profileBusy} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {profileBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save profile
            </Button>
          </div>
        </TabsContent>

        {canViewAudit ? (
          <TabsContent value="audit">
            <div className="overflow-hidden rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Action</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="hidden md:table-cell">Entity</TableHead>
                    <TableHead className="hidden sm:table-cell">User</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map((a) => {
                    const u = a.user as Row | null
                    return (
                      <TableRow key={String(a.id)}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{String(a.action)}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{String(a.summary)}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{String(a.entity ?? '—')}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {u ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Avatar name={String(u.name)} color={String(u.avatarColor)} size={20} />
                              {String(u.name)}
                            </span>
                          ) : 'System'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(a.createdAt)}</TableCell>
                      </TableRow>
                    )
                  })}
                  {audit.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No audit entries yet.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>{auditTotal} entries · page {auditPage} of {auditPages}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={auditPage <= 1} onClick={() => setAuditPage((p) => p - 1)} aria-label="Previous">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={auditPage >= auditPages} onClick={() => setAuditPage((p) => p + 1)} aria-label="Next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </motion.div>
  )
}
