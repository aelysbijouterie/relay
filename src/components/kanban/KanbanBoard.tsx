'use client'

import { useState, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskModal } from '@/components/tasks/TaskModal'
import { useTasks } from '@/hooks/useTasks'
import { useTaskStore } from '@/store/tasks'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { TASK_STATUSES } from '@/types'
import type { Task, TaskStatus } from '@/types'
import { toast } from 'sonner'

export function KanbanBoard({
  currentDepartmentId,
  currentUserName,
}: {
  currentDepartmentId?: string
  currentUserName?: string
}) {
  const { tasks, refresh }   = useTasks()
  const currentUserId        = useTaskStore(s => s.currentUserId)
  const [activeTask, setActiveTask]     = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [optimistic, setOptimistic]     = useState<Record<string, TaskStatus>>({})

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const visibleTasks = tasks
    .map(t => ({ ...t, status: (optimistic[t.id] ?? t.status) as TaskStatus }))
    .filter(t => {
      if (t.status === 'Archivé') return false
      if (!currentDepartmentId && !currentUserId) return true
      const isOwnDept  = t.department_id === currentDepartmentId
      const isCross    = t.is_cross_team && (t.extra_departments ?? []).some(d => d.id === currentDepartmentId)
      const isAssigned = currentUserId ? (t.assignees ?? []).some(a => a.id === currentUserId) : false
      return isOwnDept || isCross || isAssigned
    })

  const getColumnTasks = (status: TaskStatus) => visibleTasks.filter(t => t.status === status)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTask(tasks.find(t => t.id === event.active.id) ?? null)
  }, [tasks])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const task = tasks.find(t => t.id === active.id)
    if (!task) return

    const newStatus = TASK_STATUSES.includes(over.id as TaskStatus)
      ? (over.id as TaskStatus)
      : tasks.find(t => t.id === over.id)?.status

    if (!newStatus || newStatus === task.status) return

    // Optimiste immédiat
    setOptimistic(prev => ({ ...prev, [task.id]: newStatus }))

    try {
      await updateTaskStatus(task.id, newStatus)
      // Rafraîchit SWR — le fallback SWRConfig sera remplacé par les données fraîches
      await refresh()
      if (task.assignees?.length) {
        fetch('/api/notify/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignees:     task.assignees.map((a: { name: string; email?: string }) => ({ name: a.name, email: a.email })),
            task:          { title: task.title, priority: task.priority, deadline: task.deadline, status: newStatus },
            oldStatus:     task.status,
            department:    { name: task.department?.name ?? '', color: task.department?.color ?? '#94A3B8' },
            changedByName: currentUserName ?? 'Utilisateur',
          }),
        }).catch(() => {})
      }
    } catch {
      setOptimistic(prev => { const n = { ...prev }; delete n[task.id]; return n })
      toast.error('Erreur lors du déplacement')
    } finally {
      setOptimistic(prev => { const n = { ...prev }; delete n[task.id]; return n })
    }
  }, [tasks, refresh, currentUserName])

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
          {TASK_STATUSES.map(status => (
            <KanbanColumn key={status} status={status} tasks={getColumnTasks(status)} onTaskClick={setSelectedTask} />
          ))}
        </div>
        <DragOverlay>
          {activeTask && (
            <div className="rotate-2 scale-105">
              <TaskCard task={activeTask} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {selectedTask && (
        <TaskModal
          task={tasks.find(t => t.id === selectedTask.id) ?? selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          currentUserName={currentUserName}
        />
      )}
    </>
  )
}
