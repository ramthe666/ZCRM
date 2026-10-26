'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Plug, Unplug, Loader2, CheckCircle2, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { api, formatDate, type Row } from '@/lib/crm'
import { PageHeader } from '../shared'
import { IntegrationGlyph } from '@/components/crm/landing/glyphs'

interface ProviderMeta {
  provider: string
  name: string
  category: string
  blurb: string
  fields: { key: string; label: string; placeholder?: string; secret?: boolean }[]
  connected: boolean
  status: string | null
  connectedAt: string | null
  config: Record<string, string> | null
}

export function IntegrationsView({ role }: { role: string }) {
  const [providers, setProviders] = React.useState<ProviderMeta[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<ProviderMeta | null>(null)
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [testing, setTesting] = React.useState<string | null>(null)
  const [testResults, setTestResults] = React.useState<Record<string, { ok: boolean; message: string }>>({})

  const isAdmin = ['admin', 'owner'].includes(role)

  const fetchProviders = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ providers: ProviderMeta[] }>('/api/integrations')
      setProviders(res.providers)
    } catch {
      toast.error('Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchProviders()
  }, [fetchProviders])

  const openEdit = (p: ProviderMeta) => {
    setEditing(p)
    const init: Record<string, string> = {}
    for (const f of p.fields) init[f.key] = p.config?.[f.key] && !p.config[f.key].includes('••') ? String(p.config[f.key]) : ''
    setValues(init)
  }

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      await api('/api/integrations', { method: 'POST', body: { provider: editing.provider, config: values } })
      toast.success(`${editing.name} connected`)
      setEditing(null)
      fetchProviders()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save credentials')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async (p: ProviderMeta) => {
    try {
      await api(`/api/integrations?provider=${p.provider}`, { method: 'DELETE' })
      toast.success(`${p.name} disconnected`)
      fetchProviders()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not disconnect')
    }
  }

  const test = async (p: ProviderMeta) => {
    setTesting(p.provider)
    try {
      const res = await api<{ ok: boolean; message: string }>('/api/integrations/test', { method: 'POST', body: { provider: p.provider } })
      setTestResults((prev) => ({ ...prev, [p.provider]: res }))
      if (res.ok) toast.success(res.message)
      else toast.warning(res.message)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test failed'
      setTestResults((prev) => ({ ...prev, [p.provider]: { ok: false, message } }))
      toast.error(message)
    } finally {
      setTesting(null)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <PageHeader
        title="Integrations"
        description="Connect Nova CRM to your stack. Credentials are stored per-workspace and used by the automation engine, campaigns and messaging."
      />

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {providers.map((p) => {
            const result = testResults[p.provider]
            return (
              <div
                key={p.provider}
                className={`flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition ${p.connected ? 'border-emerald-500/40' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border bg-background">
                    <IntegrationGlyph provider={p.provider} className="h-6 w-6" />
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      p.connected
                        ? 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'text-muted-foreground'
                    }
                  >
                    {p.connected ? 'Connected' : 'Not connected'}
                  </Badge>
                </div>
                <h3 className="mt-3 font-semibold">{p.name}</h3>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.category}</p>
                <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{p.blurb}</p>

                {p.connected && p.connectedAt ? (
                  <p className="mt-2 text-xs text-muted-foreground">Connected {formatDate(p.connectedAt)}</p>
                ) : null}
                {result ? (
                  <p className={`mt-2 flex items-center gap-1.5 text-xs ${result.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {result.message}
                  </p>
                ) : null}

                {isAdmin ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant={p.connected ? 'outline' : 'default'} className={p.connected ? '' : 'bg-emerald-600 text-white hover:bg-emerald-700'} onClick={() => openEdit(p)}>
                      <Plug className="mr-1.5 h-3.5 w-3.5" /> {p.connected ? 'Edit' : 'Connect'}
                    </Button>
                    {p.connected ? (
                      <>
                        <Button size="sm" variant="outline" disabled={testing === p.provider} onClick={() => test(p)}>
                          {testing === p.provider ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Test
                        </Button>
                        <Button size="sm" variant="ghost" className="ml-auto text-rose-600 hover:text-rose-700" onClick={() => disconnect(p)}>
                          <Unplug className="mr-1 h-3.5 w-3.5" /> Disconnect
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? <IntegrationGlyph provider={editing.provider} className="h-5 w-5" /> : null}
              Connect {editing?.name}
            </DialogTitle>
            <DialogDescription>
              Paste your {editing?.name} credentials. They are stored server-side for this workspace only and never exposed to other members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {editing?.fields.map((f) => (
              <div key={f.key}>
                <Label className="mb-1.5">{f.label}</Label>
                <Input
                  type={f.secret ? 'password' : 'text'}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder ?? (f.secret ? '••••••••' : '')}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save & connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
