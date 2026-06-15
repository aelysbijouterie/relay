'use client'

import { useEffect } from 'react'
import { useTaskStore } from '@/store/tasks'
import type { Task } from '@/types'

export function TasksLoader({ tasks }: { tasks: Task[] }) {
  const setTasks = useTaskStore(s => s.setTasks)

  useEffect(() => {
    if (tasks.length > 0) setTasks(tasks)
  }, [tasks, setTasks])

  return null
}
