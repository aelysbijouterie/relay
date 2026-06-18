'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { User, Search } from 'lucide-react'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskModal } from '@/components/tasks/TaskModal'
import { useTasks } from '@/hooks/useTasks'
import { useTaskStore } from '@/store/tasks'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { TASK_STATUSES } from '@/types'
import type { Task, TaskStatus } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function KanbanBoard({
  currentDepartmentId,
  currentUserName,
}: {
  currentDepartmentId?: string
  currentUserName?: string
}) {
  const { tasks, refresh }    = useTasks()
  const currentUserId         = useTaskStore(s => s.currentUserId)
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const [search, setSearch]             = useState('')
  const [activeTask, setActiveTask]     = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [optimistic, setOptimistic]     = useState<Record<string, TaskStatus>>({})

  // Ouverture directe d'une carte via ?task=<id> (depuis le fil d'activité).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const taskId = params.get('task')
    if (taskId && tasks.length) {
      const t = tasks.find(tk => tk.id === taskId)
      if (t) {
        setSelectedTask(t)
        // Nettoie l'URL pour ne pas rouvrir au prochain rendu
        window.history.replaceState(null, '', '/kanban')
      }
    }
  }, [tasks])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Filtre : par défaut toutes les tâches non archivées
  // Toggle "Mes tâches" : uniquement les tâches où l'utilisateur est assigné ou créateur
  const visibleTasks = tasks
    .map(t => ({ ...t, status: (optimistic[t.id] ?? t.status) as TaskStatus }))
    .filter(t => {
      if (t.status === 'Archivé') return false
      // Recherche : titre, description, fournisseur/client, réf, tags
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const haystack = [
          t.title, t.description, t.fournisseur_client, t.ref_collection,
          ...(t.tags ?? []).map(tag => tag.name),
          ...(t.assignees ?? []).map(a => a.name),
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (!myTasksOnly) return true
      if (!currentUserId) return true // pas encore hydraté
      return (t.assignees ?? []).some(a => a.id === currentUserId)
        || t.created_by === currentUserId
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

    setOptimistic(prev => ({ ...prev, [task.id]: newStatus }))

    try {
      await updateTaskStatus(task.id, newStatus)
      await refresh()
      if (task.assignees?.length) {
        fetch('/api/notify/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId:        task.id,
            oldStatus:     task.status,
            changedByName: currentUserName ?? 'Utilisateur',
          }),
        }).catch(() => {})
      }
    } catch {
      toast.error('Erreur lors du déplacement')
    } finally {
      setOptimistic(prev => { const n = { ...prev }; delete n[task.id]; return n })
    }
  }, [tasks, refresh, currentUserName])

  return (
    <>
      {/* Barre de filtres */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une carte…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {visibleTasks.length} tâche{visibleTasks.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setMyTasksOnly(v => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
            myTasksOnly
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
          )}
        >
          <User className="w-3 h-3" />
          Mes tâches
        </button>
      </div>

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