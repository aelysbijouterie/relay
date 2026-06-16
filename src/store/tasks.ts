'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task, TaskStatus } from '@/types'

interface TaskStore {
  tasks: Task[]
  currentUserId:      string | null
  currentDeptId:      string | null
  setTasks:           (tasks: Task[]) => void
  setCurrentUser:     (userId: string, deptId: string) => void
  addTask:            (task: Task) => void
  updateTask:         (taskId: string, updates: Partial<Task>) => void
  removeTask:         (taskId: string) => void
  moveTask:           (taskId: string, newStatus: TaskStatus) => void
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set) => ({
      tasks:           [],
      currentUserId:   null,
      currentDeptId:   null,

      setTasks: (incoming) => set(() =>
        incoming.length === 0 ? {} : { tasks: incoming }
      ),

      setCurrentUser: (userId, deptId) =>
        set({ currentUserId: userId, currentDeptId: deptId }),

      addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),

      updateTask: (taskId, updates) =>
        set((s) => ({
          tasks: s.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t),
        })),

      removeTask: (taskId) =>
        set((s) => ({ tasks: s.tasks.filter(t => t.id !== taskId) })),

      moveTask: (taskId, newStatus) =>
        set((s) => ({
          tasks: s.tasks.map(t =>
            t.id === taskId ? { ...t, status: newStatus } : t
          ),
        })),
    }),
    {
      name: 'relays-tasks',
      // Seules les infos utilisateur sont persistées — les tâches viennent du serveur
      partialize: (s) => ({ tasks: [], currentUserId: s.currentUserId, currentDeptId: s.currentDeptId }),
    }
  )
)
