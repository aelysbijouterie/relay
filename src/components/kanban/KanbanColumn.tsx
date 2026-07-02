'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { TaskCard } from '@/components/tasks/TaskCard'
import type { Task, TaskStatus } from '@/types'
import { STATUS_COLORS } from '@/types'

interface KanbanColumnProps {
  status: TaskStatus
  tasks: Task[]
  onTaskClick: (task: Task) => void
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export function KanbanColumn({ status, tasks, onTaskClick, selectMode, selectedIds, onToggleSelect }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex flex-col min-w-[272px] max-w-[300px] w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[status] }}
          />
          <h3 className="text-sm font-semibold tracking-tight">{status}</h3>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-semibold">
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2.5 p-2.5 rounded-2xl min-h-[200px] h-fit transition-all duration-200',
          'bg-muted/40',
          isOver && 'ring-2 ring-inset'
        )}
        style={isOver ? {
          outline: `2px solid ${STATUS_COLORS[status]}`,
          outlineOffset: '-2px',
          background: `color-mix(in srgb, ${STATUS_COLORS[status]} 7%, transparent)`,
        } : {}}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick}
              selectMode={selectMode} selected={selectedIds?.has(task.id)} onToggleSelect={onToggleSelect} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 opacity-40">
            <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground" />
            <p className="text-xs text-muted-foreground">Aucune tâche</p>
          </div>
        )}
      </div>
    </div>
  )
}