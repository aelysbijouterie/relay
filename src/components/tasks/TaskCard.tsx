'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Globe, AlertCircle, Clock } from 'lucide-react'
import { cn, isOverdue, formatDeadline, getInitials } from '@/lib/utils'
import type { Task } from '@/types'
import { PRIORITY_COLORS } from '@/types'

interface TaskCardProps {
  task: Task
  onClick: (task: Task) => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const overdue = isOverdue(task.deadline) && task.status !== 'Terminé' && task.status !== 'Archivé'
  const deptColor = task.department?.color ?? '#94A3B8'

  return (
    <div
      ref={setNodeRef}
      style={overdue ? { ...style, boxShadow: '0 0 0 1.5px #EF4444, 0 4px 14px rgba(239,68,68,0.25)' } : style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task)}
      className={cn(
        'group relative rounded-xl p-3.5 space-y-2.5',
        'cursor-grab active:cursor-grabbing select-none',
        'transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-xl',
        isDragging ? 'task-dragging' : 'glass-card'
      )}
    >
      {/* Pastille "en retard" en coin */}
      {overdue && (
        <span className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center gap-1 text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white shadow-md">
          <AlertCircle className="w-2.5 h-2.5" /> En retard
        </span>
      )}
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
        style={{
          background: `linear-gradient(180deg, ${deptColor}, ${deptColor}55)`,
          boxShadow: `0 0 8px ${deptColor}66`,
        }}
      />

      <div className="pl-2">
        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {task.is_cross_team && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full glass font-medium text-muted-foreground">
              <Globe className="w-2.5 h-2.5" />
              <span>Inter-équipes</span>
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold text-white"
            style={{
              background: `linear-gradient(135deg, ${PRIORITY_COLORS[task.priority]}, ${PRIORITY_COLORS[task.priority]}99)`,
              boxShadow: `0 2px 6px ${PRIORITY_COLORS[task.priority]}44`,
            }}
          >
            {task.priority}
          </span>
        </div>

        {/* Title */}
        <p className="text-sm font-medium leading-snug line-clamp-2 text-foreground">
          {task.title}
        </p>

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            {task.tags.map(tag => (
              <span key={tag.id}
                className="text-[0.65rem] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}55` }}>
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Cross-team dept chips */}
        {task.is_cross_team && task.extra_departments && task.extra_departments.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            {task.extra_departments.map(dept => (
              <span
                key={dept.id}
                className="text-xs px-1.5 py-0.5 rounded-full text-white font-medium"
                style={{
                  background: `linear-gradient(135deg, ${dept.color}dd, ${dept.color}88)`,
                  fontSize: '0.65rem',
                }}
              >
                {dept.name}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2.5">
          {/* Deadline */}
          {task.deadline ? (
            <span className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              overdue ? 'text-red-500' : 'text-muted-foreground'
            )}>
              {overdue
                ? <AlertCircle className="w-3 h-3" />
                : <Clock className="w-3 h-3" />
              }
              {formatDeadline(task.deadline)}
            </span>
          ) : <span />}

          {/* Assignees */}
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex -space-x-1.5">
              {task.assignees.slice(0, 3).map(user => (
                <div
                  key={user.id}
                  className="w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-xs font-semibold text-white overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${deptColor}cc, ${deptColor}77)`,
                    boxShadow: `0 1px 4px ${deptColor}44`,
                  }}
                  title={user.name}
                >
                  {user.avatar_url
                    ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                    : getInitials(user.name)
                  }
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full border-2 border-background glass flex items-center justify-center text-xs text-muted-foreground">
                  +{task.assignees.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}