'use client'

import useSWR from 'swr'
import { useTaskStore } from '@/store/tasks'
import type { Task } from '@/types'

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' })
    .then(r => r.json())
    .then(d => (Array.isArray(d) ? d : []))

export function useTasks() {
  // Zustand contient déjà les tâches chargées par le layout (côté serveur)
  const storeTasks = useTaskStore(s => s.tasks)
  const setTasks   = useTaskStore(s => s.setTasks)

  const { data, error, mutate, isLoading } = useSWR<Task[]>(
    '/api/tasks',
    fetcher,
    {
      // Démarre avec les tâches déjà en mémoire — zéro délai d'affichage
      fallbackData:      storeTasks.length > 0 ? storeTasks : undefined,
      refreshInterval:   30000,
      revalidateOnFocus: true,
      onSuccess: (fresh) => {
        if (fresh.length > 0) setTasks(fresh)
      },
    }
  )

  // Si SWR n'a pas encore répondu, on affiche le store Zustand
  const tasks = (data && data.length > 0) ? data : storeTasks

  return {
    tasks,
    error,
    isLoading: isLoading && tasks.length === 0,
    refresh:   mutate,
  }
}
