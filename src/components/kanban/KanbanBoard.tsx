'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskModal } from '@/components/tasks/TaskModal'
import { useTaskStore } from '@/store/tasks'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { TASK_STATUSES } from '@/types'
import type { Task, TaskStatus } from '@/types'
import { toast } from 'sonner'

export function KanbanBoard({ currentDepartmentId }: { currentDepartmentId?: string }) {
  const { tasks, myTasksOnly, moveTask } = useTaskStore()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Afficher : tâches du dept courant + inter-équipes qui l'incluent
  const visibleTasks = tasks.filter(t => {
    if (t.status === 'Archivé') return false
    if (!currentDepartmentId) return true
    const isOwn   = t.department_id === currentDepartmentId
    const isCross = t.is_cross_team && (t.extra_departments ?? []).some(d => d.id === currentDepartmentId)
    return isOwn || isCross
  })

  const getColumnTasks = (status: TaskStatus) =>
    visibleTasks.filter(t => t.status === status)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    setActiveTask(task ?? null)
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

    if (newStatus && newStatus !== task.status) {
      moveTask(task.id, newStatus)
      try {
        await updateTaskStatus(task.id, newStatus)
      } catch {
        moveTask(task.id, task.status)
        toast.error('Erreur lors du déplacement de la tâche')
      }
    }
  }, [tasks, moveTask])

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
          {TASK_STATUSES.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={getColumnTasks(status)}
              onTaskClick={setSelectedTask}
            />
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
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </>
  )
}
