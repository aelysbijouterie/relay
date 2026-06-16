'use client'

import useSWR from 'swr'
import type { Task } from '@/types'

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' })
    .then(r => r.json())
    .then(d => (Array.isArray(d) ? d : []))

/**
 * Source de vérité des tâches.
 * - Rendu initial : données serveur injectées via SWRConfig (TasksProvider) — 0 ms de latence
 * - Ensuite : SWR revalide depuis /api/tasks toutes les 30 s
 */
export function useTasks() {
  const { data, error, mutate, isLoading } = useSWR<Task[]>('/api/tasks', fetcher, {
    refreshInterval:   30000,
    revalidateOnFocus: true,
  })

  return {
    tasks:     data ?? [],
    error,
    isLoading,
    refresh:   mutate,
  }
}
