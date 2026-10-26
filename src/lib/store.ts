'use client'

import { create } from 'zustand'

// Workspace-wide UI state shared across module views.
interface WorkspaceState {
  module: string
  openRecord: { entity: string; id: string } | null
  refreshTick: number
  setModule: (module: string) => void
  openRecordIn: (entity: string, id: string) => void
  clearOpenRecord: () => void
  bump: () => void
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  module: 'dashboard',
  openRecord: null,
  refreshTick: 0,
  setModule: (module) => set({ module, openRecord: null }),
  openRecordIn: (entity, id) => set({ module: entity, openRecord: { entity, id } }),
  clearOpenRecord: () => set({ openRecord: null }),
  bump: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
}))
