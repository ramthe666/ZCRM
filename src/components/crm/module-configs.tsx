'use client'

import type { ColumnSpec, FormFieldSpec } from './shared'
import {
  STAGES, LEAD_STATUSES, LIFECYCLE, SOURCES, TASK_STATUS, PRIORITIES, ACCOUNT_TIERS,
  STAGE_TONE, LEAD_TONE, TASK_TONE, PRIORITY_TONE, LIFECYCLE_TONE, TIER_TONE,
  stageLabel, leadStatusLabel, lifecycleLabel, sourceLabel, taskStatusLabel, priorityLabel, tierLabel,
  formatMoney, formatDate, personName, type Row,
} from '@/lib/crm'
import { StatusBadge, Avatar } from './shared'
import { UserPlus, Users, Building2, SquareCheckBig, Package, Mail, type LucideIcon } from 'lucide-react'

export interface EntityModuleConfig {
  key: string
  title: string
  singular: string
  description: string
  icon: LucideIcon
  columns: ColumnSpec[]
  formFields: FormFieldSpec[]
  filters: { name: string; label: string; options?: { value: string; label: string }[] }[]
  importable?: boolean
  exportable?: boolean
}

const opts = (list: readonly { key: string; label: string }[]) => list.map((i) => ({ value: i.key, label: i.label }))

const ownerCell = (row: Row) => {
  const owner = row.owner ?? row.assignee
  if (!owner) return <span className="text-muted-foreground">—</span>
  const o = owner as Row
  return (
    <span className="inline-flex items-center gap-1.5">
      <Avatar name={String(o.name)} color={String(o.avatarColor)} size={22} />
      <span className="hidden lg:inline">{String(o.name)}</span>
    </span>
  )
}

export const ENTITY_CONFIGS: Record<string, EntityModuleConfig> = {
  leads: {
    key: 'leads',
    title: 'Leads',
    singular: 'Lead',
    description: 'Capture, qualify and convert inbound interest.',
    icon: UserPlus,
    importable: true,
    exportable: true,
    columns: [
      { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{personName(r)}</span> },
      { key: 'company', label: 'Company', mobileHidden: true, render: (r) => String(r.company ?? '—') },
      { key: 'email', label: 'Email', mobileHidden: true, render: (r) => String(r.email ?? '—') },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge label={leadStatusLabel(String(r.status))} tone={LEAD_TONE[String(r.status)]} /> },
      { key: 'source', label: 'Source', mobileHidden: true, render: (r) => sourceLabel(String(r.source)) },
      { key: 'value', label: 'Value', render: (r) => <span className="tabular-nums">{formatMoney(r.value)}</span> },
      { key: 'owner', label: 'Owner', mobileHidden: true, render: ownerCell },
      { key: 'createdAt', label: 'Created', mobileHidden: true, render: (r) => formatDate(r.createdAt) },
    ],
    formFields: [
      { name: 'firstName', label: 'First name', type: 'text', required: true },
      { name: 'lastName', label: 'Last name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'company', label: 'Company', type: 'text' },
      { name: 'title', label: 'Job title', type: 'text' },
      { name: 'source', label: 'Source', type: 'select', options: opts(SOURCES) },
      { name: 'status', label: 'Status', type: 'select', options: opts(LEAD_STATUSES) },
      { name: 'value', label: 'Potential value ($)', type: 'number', placeholder: '0' },
      { name: 'ownerId', label: 'Owner', type: 'select', optionsFrom: 'members' },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    filters: [
      { name: 'status', label: 'Status', options: opts(LEAD_STATUSES) },
      { name: 'source', label: 'Source', options: opts(SOURCES) },
    ],
  },

  contacts: {
    key: 'contacts',
    title: 'Contacts',
    singular: 'Contact',
    description: 'Every person you do business with.',
    icon: Users,
    importable: true,
    exportable: true,
    columns: [
      { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{personName(r)}</span> },
      { key: 'email', label: 'Email', render: (r) => String(r.email ?? '—') },
      { key: 'phone', label: 'Phone', mobileHidden: true, render: (r) => String(r.phone ?? '—') },
      { key: 'account', label: 'Account', mobileHidden: true, render: (r) => String((r.account as Row)?.name ?? '—') },
      { key: 'lifecycle', label: 'Lifecycle', render: (r) => <StatusBadge label={lifecycleLabel(String(r.lifecycle))} tone={LIFECYCLE_TONE[String(r.lifecycle)]} /> },
      { key: 'owner', label: 'Owner', mobileHidden: true, render: ownerCell },
      { key: 'createdAt', label: 'Created', mobileHidden: true, render: (r) => formatDate(r.createdAt) },
    ],
    formFields: [
      { name: 'firstName', label: 'First name', type: 'text', required: true },
      { name: 'lastName', label: 'Last name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'title', label: 'Job title', type: 'text' },
      { name: 'accountId', label: 'Account', type: 'select', optionsFrom: 'accounts' },
      { name: 'lifecycle', label: 'Lifecycle stage', type: 'select', options: opts(LIFECYCLE) },
      { name: 'source', label: 'Source', type: 'select', options: opts(SOURCES) },
      { name: 'ownerId', label: 'Owner', type: 'select', optionsFrom: 'members' },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    filters: [
      { name: 'lifecycle', label: 'Lifecycle', options: opts(LIFECYCLE) },
      { name: 'source', label: 'Source', options: opts(SOURCES) },
    ],
  },

  accounts: {
    key: 'accounts',
    title: 'Accounts',
    singular: 'Account',
    description: 'Companies and organizations in your book of business.',
    icon: Building2,
    exportable: true,
    columns: [
      { key: 'name', label: 'Account', render: (r) => <span className="font-medium">{String(r.name)}</span> },
      { key: 'industry', label: 'Industry', render: (r) => String(r.industry ?? '—') },
      { key: 'tier', label: 'Tier', render: (r) => <StatusBadge label={tierLabel(String(r.tier))} tone={TIER_TONE[String(r.tier)]} /> },
      { key: 'website', label: 'Website', mobileHidden: true, render: (r) => String(r.website ?? '—') },
      { key: 'revenue', label: 'Revenue', mobileHidden: true, render: (r) => (r.revenue ? formatMoney(r.revenue) : '—') },
      { key: 'owner', label: 'Owner', mobileHidden: true, render: ownerCell },
    ],
    formFields: [
      { name: 'name', label: 'Account name', type: 'text', required: true, full: true },
      { name: 'website', label: 'Website', type: 'text', placeholder: 'acme.com' },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'industry', label: 'Industry', type: 'text' },
      { name: 'size', label: 'Company size', type: 'select', options: [{ value: '1-10', label: '1–10' }, { value: '11-50', label: '11–50' }, { value: '51-200', label: '51–200' }, { value: '201-1000', label: '201–1,000' }, { value: '1000+', label: '1,000+' }] },
      { name: 'tier', label: 'Tier', type: 'select', options: opts(ACCOUNT_TIERS) },
      { name: 'city', label: 'City', type: 'text' },
      { name: 'country', label: 'Country', type: 'text' },
      { name: 'revenue', label: 'Annual revenue ($)', type: 'number' },
      { name: 'ownerId', label: 'Owner', type: 'select', optionsFrom: 'members' },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    filters: [
      { name: 'tier', label: 'Tier', options: opts(ACCOUNT_TIERS) },
    ],
  },

  tasks: {
    key: 'tasks',
    title: 'Tasks',
    singular: 'Task',
    description: 'To-dos and follow-ups across the pipeline.',
    icon: SquareCheckBig,
    exportable: true,
    columns: [
      { key: 'title', label: 'Task', render: (r) => <span className="font-medium">{String(r.title)}</span> },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge label={taskStatusLabel(String(r.status))} tone={TASK_TONE[String(r.status)]} /> },
      { key: 'priority', label: 'Priority', render: (r) => <StatusBadge label={priorityLabel(String(r.priority))} tone={PRIORITY_TONE[String(r.priority)]} /> },
      { key: 'dueAt', label: 'Due', render: (r) => (r.dueAt ? formatDate(r.dueAt) : '—') },
      { key: 'assignee', label: 'Assignee', mobileHidden: true, render: ownerCell },
      { key: 'relatedType', label: 'Related to', mobileHidden: true, render: (r) => (r.relatedType ? `${String(r.relatedType)}${r.relatedId ? '' : ''}` : '—') },
    ],
    formFields: [
      { name: 'title', label: 'Task', type: 'text', required: true, full: true },
      { name: 'status', label: 'Status', type: 'select', options: opts(TASK_STATUS) },
      { name: 'priority', label: 'Priority', type: 'select', options: opts(PRIORITIES) },
      { name: 'dueAt', label: 'Due date', type: 'date' },
      { name: 'assigneeId', label: 'Assignee', type: 'select', optionsFrom: 'members' },
      { name: 'relatedType', label: 'Related to (type)', type: 'select', options: [{ value: 'lead', label: 'Lead' }, { value: 'contact', label: 'Contact' }, { value: 'account', label: 'Account' }, { value: 'deal', label: 'Deal' }] },
      { name: 'relatedId', label: 'Related ID', type: 'text', placeholder: 'Paste record ID' },
      { name: 'description', label: 'Description', type: 'textarea', full: true },
    ],
    filters: [
      { name: 'status', label: 'Status', options: opts(TASK_STATUS) },
      { name: 'priority', label: 'Priority', options: opts(PRIORITIES) },
    ],
  },

  products: {
    key: 'products',
    title: 'Products',
    singular: 'Product',
    description: 'Your catalog of plans and services.',
    icon: Package,
    exportable: true,
    columns: [
      { key: 'name', label: 'Product', render: (r) => <span className="font-medium">{String(r.name)}</span> },
      { key: 'sku', label: 'SKU', mobileHidden: true, render: (r) => String(r.sku ?? '—') },
      { key: 'unitPrice', label: 'Price', render: (r) => <span className="tabular-nums">{formatMoney(r.unitPrice)}</span> },
      { key: 'billingCycle', label: 'Billing', mobileHidden: true, render: (r) => String(r.billingCycle).replace('_', ' ') },
      { key: 'active', label: 'Status', render: (r) => <StatusBadge label={r.active ? 'Active' : 'Inactive'} tone={r.active ? 'emerald' : 'slate'} /> },
    ],
    formFields: [
      { name: 'name', label: 'Product name', type: 'text', required: true, full: true },
      { name: 'sku', label: 'SKU', type: 'text' },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'unitPrice', label: 'Unit price ($)', type: 'number', required: true },
      { name: 'billingCycle', label: 'Billing cycle', type: 'select', options: [{ value: 'one_time', label: 'One-time' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }] },
      { name: 'active', label: 'Active', type: 'checkbox' },
      { name: 'description', label: 'Description', type: 'textarea', full: true },
    ],
    filters: [],
  },

  templates: {
    key: 'templates',
    title: 'Email Templates',
    singular: 'Template',
    description: 'Reusable email templates for campaigns and automation.',
    icon: Mail,
    columns: [
      { key: 'name', label: 'Template', render: (r) => <span className="font-medium">{String(r.name)}</span> },
      { key: 'subject', label: 'Subject', render: (r) => <span className="text-muted-foreground">{String(r.subject)}</span> },
      { key: 'category', label: 'Category', mobileHidden: true, render: (r) => <StatusBadge label={String(r.category)} tone="teal" /> },
      { key: 'updatedAt', label: 'Updated', mobileHidden: true, render: (r) => formatDate(r.updatedAt) },
    ],
    formFields: [
      { name: 'name', label: 'Template name', type: 'text', required: true, full: true },
      { name: 'subject', label: 'Subject line', type: 'text', required: true, full: true, placeholder: 'Use {{name}} for personalization' },
      { name: 'category', label: 'Category', type: 'select', options: [{ value: 'general', label: 'General' }, { value: 'sales', label: 'Sales' }, { value: 'onboarding', label: 'Onboarding' }, { value: 'support', label: 'Support' }, { value: 'marketing', label: 'Marketing' }] },
      { name: 'body', label: 'Body', type: 'textarea', required: true, full: true, placeholder: 'Hi {{name}}, …' },
    ],
    filters: [],
  },
}

export const DEAL_FORM_FIELDS: FormFieldSpec[] = [
  { name: 'name', label: 'Deal name', type: 'text', required: true, full: true },
  { name: 'amount', label: 'Amount ($)', type: 'number', required: true },
  { name: 'stage', label: 'Stage', type: 'select', options: opts(STAGES) },
  { name: 'expectedCloseAt', label: 'Expected close', type: 'date' },
  { name: 'accountId', label: 'Account', type: 'select', optionsFrom: 'accounts' },
  { name: 'contactId', label: 'Primary contact', type: 'select', optionsFrom: 'contacts' },
  { name: 'source', label: 'Source', type: 'select', options: opts(SOURCES) },
  { name: 'ownerId', label: 'Owner', type: 'select', optionsFrom: 'members' },
  { name: 'notes', label: 'Notes', type: 'textarea', full: true },
]
