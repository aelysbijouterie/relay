'use client'

import { useMemo, useState } from 'react'
import { format, parseISO, isToday, isTomorrow, isThisWeek, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { PRIORITY_COLORS, STATUS_COLORS } from '@/types'
import { useTasks } from '@/hooks/useTasks'
import type { Task, TaskPriority } from '@/types'

type GroupBy = 'date' | 'status' | 'priority'

const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: 'date',     label: 'Date' },
  { key: 'status',   label: 'Statut' },
  { key: 'priority', label: 'Priorité' },
]

// Regroupement par tranche de date, avec ordre d'affichage stable.
const DATE_BUCKETS = ['En retard', "Aujourd'hui", 'Demain', 'Cette semaine', 'Plus tard'] as const
type DateBucket = typeof DATE_BUCKETS[number]

function dateBucket(deadline: string): DateBucket {
  const d = parseISO(deadline)
  if (isToday(d)) return "Aujourd'hui"
  if (isPast(d)) return 'En retard'
  if (isTomorrow(d)) return 'Demain'
  if (isThisWeek(d, { weekStartsOn: 1 })) return 'Cette semaine'
  return 'Plus tard'
}

const BUCKET_COLORS: Record<DateBucket, string> = {
  'En retard':      '#EF4444',
  "Aujourd'hui":    '#F97316',
  'Demain':         '#3B82F6',
  'Cette semaine':  '#8B5CF6',
  'Plus tard':      '#94A3B8',
}

export function TimelineView() {
  const { tasks } = useTasks()
  const [groupBy, setGroupBy] = useState<GroupBy>('date')

  const tasksWithDeadline = useMemo(() =>
    tasks
      .filter(t => t.deadline && t.status !== 'Archivé')
      .sort((a, b) => a.deadline!.localeCompare(b.deadline!)),
    [tasks]
  )

  const grouped = useMemo(() => {
    const groups: Record<string, Task[]> = {}
    for (const task of tasksWithDeadline) {
      const key = groupBy === 'status'
        ? task.status
        : groupBy === 'priority'
          ? task.priority
          : dateBucket(task.deadline!)
      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    }
    return groups
  }, [tasksWithDeadline, groupBy])

  // Ordre d'affichage des groupes selon le mode
  const orderedKeys = useMemo(() => {
    if (groupBy === 'date') return DATE_BUCKETS.filter(b => grouped[b]?.length)
    if (groupBy === 'priority') return ['Urgent', 'Élevée', 'Moyenne', 'Faible'].filter(p => grouped[p]?.length)
    return ['A Faire', 'En cours', 'Bloqué', 'A revoir', 'Terminé'].filter(s => grouped[s]?.length)
  }, [groupBy, grouped])

  function groupColor(key: string): string {
    if (groupBy === 'date') return BUCKET_COLORS[key as DateBucket] ?? '#94A3B8'
    if (groupBy === 'priority') return PRIORITY_COLORS[key as keyof typeof PRIORITY_COLORS]
    return STATUS_COLORS[key as keyof typeof STATUS_COLORS]
  }

  return (
    <div className="space-y-6">
      {/* Contrôles */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Grouper par :</span>
        {GROUP_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setGroupBy(key)}
            className={cn('text-sm px-3 py-1.5 rounded-lg border transition-colors',
              groupBy === key ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Vide */}
      {tasksWithDeadline.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium">Aucune tâche avec échéance</p>
          <p className="text-sm mt-1">Ajoutez une date d&apos;échéance à vos tâches pour les voir ici</p>
        </div>
      )}

      {/* Groupes */}
      {orderedKeys.map(group => {
        const groupTasks = grouped[group]
        return (
          <div key={group}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: groupColor(group) }} />
              {group}
              <span className="text-xs text-muted-foreground font-normal">({groupTasks.length})</span>
            </h3>

            <div className="space-y-2">
              {groupTasks.map(task => (
                <div key={task.id} className="flex items-center gap-4 p-3 bg-card border border-border rounded-lg hover:shadow-sm transition-shadow">
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: task.department?.color ?? '#94A3B8' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    {task.department && <p className="text-xs text-muted-foreground">{task.department.name}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: PRIORITY_COLORS[task.priority as TaskPriority] }}>
                      {task.priority}
                    </span>
                    {task.deadline && (
                      <span className={cn('text-xs font-medium',
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
        )
      })}
    </div>
  )
}