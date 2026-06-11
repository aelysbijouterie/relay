'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTaskStore } from '@/store/tasks'
import type { Task } from '@/types'

export function useRealtimeTasks(departmentId: string) {
  const supabase = createClient()
  const { addTask, updateTask, removeTask } = useTaskStore()

  useEffect(() => {
    const channel = supabase
      .channel(`tasks-dept-${departmentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tasks',
        filter: `department_id=eq.${departmentId}`,
      }, (payload) => {
        addTask(payload.new as Task)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tasks',
        filter: `department_id=eq.${departmentId}`,
      }, (payload) => {
        updateTask(payload.new.id, payload.new as Partial<Task>)
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'tasks',
        filter: `department_id=eq.${departmentId}`,
      }, (payload) => {
        removeTask(payload.old.id)
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'task_departments',
        filter: `department_id=eq.${departmentId}`,
      }, () => {
        // Reload tasks when a cross-team task is linked
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [departmentId, supabase, addTask, updateTask, removeTask])
}
