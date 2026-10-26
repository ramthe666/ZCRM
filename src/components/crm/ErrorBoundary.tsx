'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { LogoMark } from '@/components/crm/landing/illustrations'
import { AlertTriangle, RotateCw, LogOut } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Called when the user chooses to sign out from the crash screen */
  onSignOut?: () => void
  /** Optional label shown above the message (e.g. module name) */
  area?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * App-level error boundary. Keeps a single broken view from taking down the
 * whole SPA — the user gets a calm, branded recovery screen with retry and
 * sign-out actions instead of a raw runtime error overlay.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface in server/browser consoles for diagnostics; never throws.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private reset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const authIssue = /sign|auth|session|401/i.test(error.message)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
        <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border bg-card">
          <LogoMark className="h-10 w-10" />
          <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
        </span>
        <div className="max-w-md space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight">
            {authIssue ? 'Your session needs attention' : 'Something went wrong'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {authIssue
              ? 'We could not verify your session. This is usually fixed by signing in again — your work is safe.'
              : 'An unexpected error interrupted this screen. Retrying usually resolves it. If it keeps happening, try signing out and back in.'}
          </p>
          <p className="pt-1 font-mono text-[11px] text-muted-foreground/70">{error.message}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={this.reset} className="bg-emerald-600 text-white hover:bg-emerald-700">
            <RotateCw className="mr-1.5 h-4 w-4" /> Try again
          </Button>
          {this.props.onSignOut ? (
            <Button variant="outline" onClick={this.props.onSignOut}>
              <LogOut className="mr-1.5 h-4 w-4" /> Sign out
            </Button>
          ) : null}
        </div>
        {this.props.area ? (
          <p className="text-xs text-muted-foreground/60">Section: {this.props.area}</p>
        ) : null}
      </div>
    )
  }
}
