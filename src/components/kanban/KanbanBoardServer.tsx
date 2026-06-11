'use client'

import { useEffect } from 'react'
import { useTaskStore } from '@/store/tasks'
import { KanbanBoard } from './KanbanBoard'
import type { Task } from '@/types'

export function KanbanBoardServer({ initialTasks, currentDepartmentId }: { initialTasks: Task[]; currentDepartmentId: string }) {
  const setTasks = useTaskStore(s => s.setTasks)

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks, setTasks])

  return <KanbanBoard currentDepartmentId={currentDepartmentId} />
}
