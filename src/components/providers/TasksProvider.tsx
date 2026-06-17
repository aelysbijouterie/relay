'use client'

import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import { useTaskStore } from '@/store/tasks'
import { useRealtimeTasks } from '@/hooks/useRealtimeTasks'
import type { Task } from '@/types'

interface Props {
  children:     React.ReactNode
  initialTasks: Task[]
  userId:       string
  deptId:       string
}

/**
 * Fournit les tâches chargées côté serveur comme fallback SWR immédiat.
 * Pattern recommandé Next.js App Router + SWR :
 * https://swr.vercel.app/docs/with-nextjs#pre-rendering-with-default-data
 */
export function TasksProvider({ children, initialTasks, userId, deptId }: Props) {
  const setCurrentUser = useTaskStore(s => s.setCurrentUser)

  // Persiste userId + deptId dans Zustand pour le filtre Kanban
  useEffect(() => {
    setCurrentUser(userId, deptId)
  }, [userId, deptId, setCurrentUser])

  // Un seul abonnement Realtime pour toute la session dashboard (Kanban,
  // Calendrier, Chronologie, Stats partagent la même clé SWR '/api/tasks').
  useRealtimeTasks()

  return (
    <SWRConfig value={{ fallback: { '/api/tasks': initialTasks } }}>
      {children}
    </SWRConfig>
  )
}
