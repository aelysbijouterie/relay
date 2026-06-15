'use client'

import useSWR from 'swr'
import type { Task } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useTasks() {
  const { data, error, mutate, isLoading } = useSWR<Task[]>('/api/tasks', fetcher, {
    refreshInterval: 30000, // rafraîchit toutes les 30s
    revalidateOnFocus: true,
  })

  return {
    tasks:     data ?? [],
    error,
    isLoading,
    refresh:   mutate,
  }
}
