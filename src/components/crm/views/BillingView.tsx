'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Check, Loader2, CreditCard, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { api, formatDate, formatMoney, type Row } from '@/lib/crm'
import { useWorkspace } from '@/lib/store'
import { PageHeader } from '../shared'

interface BillingData {
  org: Row
  plan: { key: string; name: string; price: number; yearly: number; seats: number; contacts: number; workflows: number; campaigns: number; blurb: string; features: string[] }
  plans: { key: string; name: string; price: number; yearly: number; seats: number; contacts: number; workflows: number; campaigns: number; blurb: string; features: string[] }[]
  usage: { seats: { used: number; limit: number }; contacts: { used: number; limit: number }; workflows: { used: number; limit: number }; campaigns: { used: number; limit: number } }
  invoices: Row[]
}

export function BillingView({ role }: { role: string }) {
  const store = useWorkspace()
  const [data, setData] = React.useState<BillingData | null>(null)
  const [checkout, setCheckout] = React.useState<{ plan: string; name: string; price: number; yearly: number } | null>(null)
  const [cycle, setCycle] = React.useState<'monthly' | 'yearly'>('monthly')
  const [busy, setBusy] = React.useState(false)
  const [card, setCard] = React.useState({ number: '', name: '', expiry: '', cvc: '' })

  const isOwner = role === 'owner'

  const fetchBilling = React.useCallback(async () => {
    try {
      const res = await api<BillingData>('/api/billing/invoices')
      setData(res)
    } catch {
      toast.error('Failed to load billing')
    }
  }, [])

  React.useEffect(() => {
    void fetchBilling()
  }, [fetchBilling, store.refreshTick])

  // sync cycle from org after load
  React.useEffect(() => {
    if (data?.org) setCycle(String(data.org.billingCycle) === 'yearly' ? 'yearly' : 'monthly')
  }, [data?.org])

  if (!data) return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>

  const usageRows = [
    { label: 'Seats', ...data.usage.seats },
    { label: 'Contacts', ...data.usage.contacts },
    { label: 'Workflows', ...data.usage.workflows },
    { label: 'Campaigns', ...data.usage.campaigns },
  ]

  const subscribe = async () => {
    if (!checkout) return
    setBusy(true)
    try {
      await api('/api/billing/subscribe', { method: 'POST', body: { plan: checkout.plan, cycle } })
      toast.success(`You're on the ${checkout.name} plan 🎉`, { description: 'In production this step is confirmed by a Stripe webhook.' })
      setCheckout(null)
      setCard({ number: '', name: '', expiry: '', cvc: '' })
      store.bump()
      fetchBilling()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Subscription failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-5">
      <PageHeader title="Billing & Plans" description="Your subscription, usage and invoices.">
        <div className="flex items-center rounded-lg border p-0.5 text-sm">
          <button
            className={`rounded-md px-3 py-1.5 ${cycle === 'monthly' ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
            onClick={() => setCycle('monthly')}
          >
            Monthly
          </button>
          <button
            className={`rounded-md px-3 py-1.5 ${cycle === 'yearly' ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
            onClick={() => setCycle('yearly')}
          >
            Yearly <span className="text-emerald-600 dark:text-emerald-400">−20%</span>
          </button>
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Current plan</h3>
            <Badge className="border-transparent bg-emerald-600 text-white capitalize">{String(data.org.plan)}</Badge>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {formatMoney(cycle === 'yearly' ? data.plan.yearly : data.plan.price)}
            <span className="text-sm font-normal text-muted-foreground">/user/mo</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{data.plan.blurb}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Status: <span className="capitalize">{String(data.org.planStatus)}</span>
            {data.org.trialEndsAt ? ` · trial ends ${formatDate(data.org.trialEndsAt)}` : ''}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> Usage this cycle
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {usageRows.map((u) => {
              const pct = u.limit >= 1000000 ? Math.min(100, (u.used / Math.max(u.limit, 1)) * 100) : Math.min(100, (u.used / u.limit) * 100)
              const unlimited = u.limit >= 1000000
              const barColor = pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
              return (
                <div key={u.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{u.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {u.used.toLocaleString()} / {unlimited ? '∞' : u.limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.plans.map((p) => {
          const current = p.key === data.org.plan
          const price = cycle === 'yearly' ? p.yearly : p.price
          return (
            <div
              key={p.key}
              className={`relative flex flex-col rounded-2xl border bg-card p-5 shadow-sm ${current ? 'border-emerald-500 ring-1 ring-emerald-500/40' : p.key === 'professional' ? 'border-emerald-500/50' : ''}`}
            >
              {p.key === 'professional' ? (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 border-transparent bg-emerald-600 text-white">Most popular</Badge>
              ) : null}
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-2 text-3xl font-bold tabular-nums">
                {p.key === 'enterprise' ? 'Custom' : formatMoney(price)}
                {p.key !== 'enterprise' ? <span className="text-sm font-normal text-muted-foreground">/user/mo</span> : null}
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={`mt-5 w-full ${current ? '' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                variant={current ? 'outline' : 'default'}
                disabled={current || !isOwner}
                onClick={() => setCheckout({ plan: p.key, name: p.name, price: p.price, yearly: p.yearly })}
              >
                {current ? 'Current plan' : isOwner ? `Switch to ${p.name}` : 'Owner only'}
              </Button>
            </div>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-5 py-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <CreditCard className="h-4 w-4 text-emerald-600" /> Invoices
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Invoice</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="hidden sm:table-cell">Seats</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.invoices.map((inv) => (
              <TableRow key={String(inv.id)}>
                <TableCell className="font-mono text-xs">{String(inv.number)}</TableCell>
                <TableCell className="capitalize">{String(inv.plan)}</TableCell>
                <TableCell className="hidden sm:table-cell">{String(inv.seats)}</TableCell>
                <TableCell className="tabular-nums">{formatMoney(inv.amount)}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{formatDate(inv.date)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={inv.status === 'paid' ? 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'}>
                    {String(inv.status)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {data.invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No invoices yet.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!checkout} onOpenChange={(o) => !o && setCheckout(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Checkout — {checkout?.name}</DialogTitle>
            <DialogDescription>
              Mock checkout for the demo. In production, this opens a Stripe Checkout session and the plan activates via webhook.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{checkout?.name} · {cycle}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Seats</span>
                <span className="font-medium">{data.usage.seats.used}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Total / month</span>
                <span className="font-bold tabular-nums">
                  {formatMoney((cycle === 'yearly' ? (checkout?.yearly ?? 0) : (checkout?.price ?? 0)) * data.usage.seats.used)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="mb-1.5">Card number</Label>
                <Input value={card.number} onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))} placeholder="4242 4242 4242 4242" inputMode="numeric" />
              </div>
              <div>
                <Label className="mb-1.5">Expiry</Label>
                <Input value={card.expiry} onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))} placeholder="12/28" />
              </div>
              <div>
                <Label className="mb-1.5">CVC</Label>
                <Input value={card.cvc} onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))} placeholder="123" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCheckout(null)}>Cancel</Button>
            <Button onClick={subscribe} disabled={busy || !card.number} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Pay & activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
