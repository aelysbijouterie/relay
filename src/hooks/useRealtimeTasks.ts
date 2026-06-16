'use client'

import { useEffect } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'

/**
 * Abonnement Supabase Realtime.
 * Toute modification en base déclenche un re-fetch SWR de /api/tasks.
 */
export function useRealtimeTasks(departmentId: string) {
  const supabase = createClient()

  useEffect(() => {
    const refresh = () => mutate('/api/tasks')

    const channel = supabase
      .channel(`tasks-dept-${departmentId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks',          filter: `department_id=eq.${departmentId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks',          filter: `department_id=eq.${departmentId}` }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks',          filter: `department_id=eq.${departmentId}` }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_departments', filter: `department_id=eq.${departmentId}` }, refresh)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [departmentId, supabase])
}
