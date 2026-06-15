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

      setTasks: (incoming) => set(() => {
        // Si le serveur retourne des tâches, elles font autorité
        // Si le serveur retourne vide, on garde le store actuel
        if (incoming.length === 0) return {}
        return { tasks: incoming }
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
      // Ne pas persister les tâches en localStorage — elles viennent du serveur
      partialize: () => ({ tasks: [] }),
    }
  )
)
