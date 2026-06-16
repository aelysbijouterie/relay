'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task, TaskStatus } from '@/types'

interface TaskStore {
  // Infos utilisateur courant (pour le filtre Kanban et les actions)
  currentUserId: string | null
  currentDeptId: string | null
  setCurrentUser: (userId: string, deptId: string) => void

  // Cache optimiste local uniquement — la vérité vient de SWR/Supabase
  optimisticUpdates: Record<string, Partial<Task>>
  setOptimisticStatus: (taskId: string, status: TaskStatus) => void
  clearOptimistic:     (taskId: string) => void
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set) => ({
      currentUserId:     null,
      currentDeptId:     null,
      optimisticUpdates: {},

      setCurrentUser: (userId, deptId) =>
        set({ currentUserId: userId, currentDeptId: deptId }),

      setOptimisticStatus: (taskId, status) =>
        set(s => ({ optimisticUpdates: { ...s.optimisticUpdates, [taskId]: { status } } })),

      clearOptimistic: (taskId) =>
        set(s => {
          const next = { ...s.optimisticUpdates }
          delete next[taskId]
          return { optimisticUpdates: next }
        }),
    }),
    {
      name:        'relays-user',
      partialize:  (s) => ({ currentUserId: s.currentUserId, currentDeptId: s.currentDeptId }),
    }
  )
)
