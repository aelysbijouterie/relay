'use client'

import { useMemo, useState } from 'react'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { PRIORITY_COLORS, STATUS_COLORS } from '@/types'
import type { Task } from '@/types'

interface TimelineViewProps {
  tasks: Task[]
}

type GroupBy = 'status' | 'priority'

export function TimelineView({ tasks }: TimelineViewProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [myTasksOnly, setMyTasksOnly] = useState(false)

  const tasksWithDeadline = useMemo(() =>
    tasks
      .filter(t => t.deadline && t.status !== 'Archivé')
      .sort((a, b) => a.deadline!.localeCompare(b.deadline!)),
    [tasks]
  )

  const grouped = useMemo(() => {
    const groups: Record<string, Task[]> = {}
    for (const task of tasksWithDeadline) {
      const key = groupBy === 'status' ? task.status : task.priority
      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    }
    return groups
  }, [tasksWithDeadline, groupBy])

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Grouper par :</span>
        <button
          onClick={() => setGroupBy('status')}
          className={cn('text-sm px-3 py-1.5 rounded-lg border transition-colors',
            groupBy === 'status' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
          )}
        >
          Statut
        </button>
        <button
          onClick={() => setGroupBy('priority')}
          className={cn('text-sm px-3 py-1.5 rounded-lg border transition-colors',
            groupBy === 'priority' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
          )}
        >
          Priorité
        </button>
      </div>

      {/* Empty state */}
      {tasksWithDeadline.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium">Aucune tâche avec échéance</p>
          <p className="text-sm mt-1">Ajoutez une date d&apos;échéance à vos tâches pour les voir ici</p>
        </div>
      )}

      {/* Groups */}
      {Object.entries(grouped).map(([group, groupTasks]) => (
        <div key={group}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: groupBy === 'status'
                  ? STATUS_COLORS[group as keyof typeof STATUS_COLORS]
                  : PRIORITY_COLORS[group as keyof typeof PRIORITY_COLORS]
              }}
            />
            {group}
            <span className="text-xs text-muted-foreground font-normal">({groupTasks.length})</span>
          </h3>

          <div className="space-y-2">
            {groupTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-4 p-3 bg-card border border-border rounded-lg hover:shadow-sm transition-shadow"
              >
                <div
                  className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{ backgroundColor: task.department?.color ?? '#94A3B8' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {task.department && (
                    <p className="text-xs text-muted-foreground">{task.department.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className="text-xs px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                  >
                    {task.priority}
                  </span>
                  {task.deadline && (
                    <span className={cn(
                      'text-xs font-medium',
                      isToday(parseISO(task.deadline)) ? 'text-orange-500' : 'text-muted-foreground'
                    )}>
                      {format(parseISO(task.deadline), 'd MMM yyyy', { locale: fr })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {tasksWithDeadline.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          Aucune tâche avec une échéance définie.
        </div>
      )}
    </div>
  )
}
