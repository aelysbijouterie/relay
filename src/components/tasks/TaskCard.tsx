'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Globe, AlertCircle, Clock, MessageSquare, Check } from 'lucide-react'
import { cn, isOverdue, formatDeadline, getInitials } from '@/lib/utils'
import type { Task } from '@/types'
import { PRIORITY_COLORS } from '@/types'

interface TaskCardProps {
  task: Task
  onClick: (task: Task) => void
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
}

export function TaskCard({ task, onClick, selectMode, selected, onToggleSelect }: TaskCardProps) {
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

  // Tâche qui stagne : aucun mouvement depuis 7 jours, sur un statut actif.
  const stale = (() => {
    if (!task.updated_at) return false
    if (!['En cours', 'A Faire', 'Bloqué'].includes(task.status)) return false
    const days = (Date.now() - new Date(task.updated_at).getTime()) / 86400000
    return days >= 7
  })()

  // Progression des sous-tâches (si présentes)
  const subtasks = task.subtasks ?? []
  const subTotal = subtasks.length
  const subDone  = subtasks.filter(s => s.status === 'Terminé').length
  const subPct   = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0

  return (
    <div
      ref={setNodeRef}
      style={overdue
        ? { ...style, boxShadow: '0 0 0 1.5px #EF4444, 0 4px 14px rgba(239,68,68,0.18)' }
        : style}
      {...(selectMode ? {} : attributes)}
      {...(selectMode ? {} : listeners)}
      onClick={() => selectMode ? onToggleSelect?.(task.id) : onClick(task)}
      className={cn(
        'group relative rounded-2xl p-3.5 space-y-2.5',
        selectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
        'select-none',
        'transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-lg',
        isDragging ? 'task-dragging' : 'bg-card border border-border shadow-sm',
        selected && 'ring-2 ring-primary ring-offset-1'
      )}
    >
      {/* Case de sélection (mode sélection) */}
      {selectMode && (
        <span className={cn('absolute top-2 right-2 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
          selected ? 'bg-primary border-primary text-white' : 'bg-card border-border')}>
          {selected && <Check className="w-3 h-3" />}
        </span>
      )}
      {/* Pastille "en retard" en coin */}
      {overdue && (
        <span className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center gap-1 text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white shadow-md">
          <AlertCircle className="w-2.5 h-2.5" /> En retard
        </span>
      )}
      {/* Left accent bar — couleur de l'espace, épouse les arrondis de la carte */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[4px] rounded-l-2xl overflow-hidden"
        style={{ backgroundColor: deptColor }}
      />

      <div className="pl-2">
        {/* Titre en premier */}
        <p className="text-sm font-semibold leading-snug line-clamp-2 text-foreground mb-2">
          {task.title}
        </p>

        {/* Badge : tâche qui stagne (aucun mouvement depuis 7 jours) */}
        {stale && !overdue && (
          <span className="inline-flex items-center gap-1 text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-md mb-2"
            style={{ backgroundColor: 'rgba(217,119,6,0.12)', color: '#B45309' }}
            title="Aucun mouvement depuis plus de 7 jours">
            <Clock className="w-2.5 h-2.5" /> En pause depuis 7 j
          </span>
        )}

        {/* Priorité + étiquettes ensemble, sous le titre */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1 text-[0.65rem] px-2 py-0.5 rounded-md font-bold"
            style={{
              backgroundColor: `${PRIORITY_COLORS[task.priority]}1A`,
              color: PRIORITY_COLORS[task.priority],
            }}
          >
            {task.priority}
          </span>
          {task.is_cross_team && (
            <span className="inline-flex items-center gap-1 text-[0.65rem] px-2 py-0.5 rounded-md bg-muted font-semibold text-muted-foreground">
              <Globe className="w-2.5 h-2.5" />
              <span>Inter-équipes</span>
            </span>
          )}
          {task.tags && task.tags.map(tag => (
            <span key={tag.id}
              className="text-[0.65rem] px-1.5 py-0.5 rounded-md font-semibold"
              style={{ backgroundColor: `${tag.color}1A`, color: tag.color }}>
              {tag.name}
            </span>
          ))}
        </div>

        {/* Cross-team dept chips */}
        {task.is_cross_team && task.extra_departments && task.extra_departments.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            {task.extra_departments.map(dept => (
              <span
                key={dept.id}
                className="text-[0.65rem] px-1.5 py-0.5 rounded-md text-white font-semibold"
                style={{ backgroundColor: dept.color }}
              >
                {dept.name}
              </span>
            ))}
          </div>
        )}

        {/* Barre de progression des sous-tâches */}
        {subTotal > 0 && (
          <div className="mt-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[0.65rem] font-semibold text-muted-foreground">Sous-tâches</span>
              <span className="text-[0.65rem] font-bold" style={{ color: deptColor }}>{subDone}/{subTotal}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${Math.max(subPct, 4)}%`, backgroundColor: deptColor }} />
            </div>
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
                  className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-xs font-semibold text-white overflow-hidden"
                  style={{ backgroundColor: deptColor }}
                  title={user.name}
                >
                  {user.avatar_url
                    ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                    : getInitials(user.name)
                  }
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full border-2 border-card bg-muted flex items-center justify-center text-xs text-muted-foreground font-semibold">
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