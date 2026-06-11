'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task, TaskStatus } from '@/types'

interface TaskStore {
  tasks: Task[]
  myTasksOnly: boolean
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (taskId: string, updates: Partial<Task>) => void
  removeTask: (taskId: string) => void
  toggleMyTasks: () => void
  moveTask: (taskId: string, newStatus: TaskStatus) => void
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set) => ({
      tasks: [],
      myTasksOnly: false,

      // Merge : les tâches statiques (démo) remplacent leurs IDs,
      // les tâches créées par l'utilisateur (id starts with 'task-') sont conservées
      setTasks: (incoming) => set((s) => {
        const userCreated = s.tasks.filter(t => t.id.startsWith('task-'))
        const incomingIds = new Set(incoming.map(t => t.id))
        const keptUserTasks = userCreated.filter(t => !incomingIds.has(t.id))
        return { tasks: [...incoming, ...keptUserTasks] }
      }),

      addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),
      updateTask: (taskId, updates) =>
        set((s) => ({
          tasks: s.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t),
        })),
      removeTask: (taskId) =>
        set((s) => ({ tasks: s.tasks.filter(t => t.id !== taskId) })),
      toggleMyTasks: () => set((s) => ({ myTasksOnly: !s.myTasksOnly })),
      moveTask: (taskId, newStatus) =>
        set((s) => ({
          tasks: s.tasks.map(t =>
            t.id === taskId ? { ...t, status: newStatus } : t
          ),
        })),
    }),
    {
      name: 'relays-tasks',
      // Ne persister que les tâches créées par l'utilisateur
      partialize: (state) => ({
        tasks: state.tasks.filter(t => t.id.startsWith('task-')),
      }),
    }
  )
)
