'use client'

import { useEffect } from 'react'
import { useTaskStore } from '@/store/tasks'
import type { Task } from '@/types'

interface Props {
  tasks:  Task[]
  userId: string
  deptId: string
}

export function TasksLoader({ tasks, userId, deptId }: Props) {
  const setTasks       = useTaskStore(s => s.setTasks)
  const setCurrentUser = useTaskStore(s => s.setCurrentUser)

  useEffect(() => {
    setCurrentUser(userId, deptId)
    if (tasks.length > 0) setTasks(tasks)
  }, [tasks, userId, deptId, setTasks, setCurrentUser])

  return null
}
