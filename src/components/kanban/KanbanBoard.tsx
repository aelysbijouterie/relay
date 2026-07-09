'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { User, Search, CheckCircle2, Archive, Trash2 } from 'lucide-react'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskModal } from '@/components/tasks/TaskModal'
import { useTasks } from '@/hooks/useTasks'
import { useTaskStore } from '@/store/tasks'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { TASK_STATUSES, STATUS_LABELS } from '@/types'
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
  const [selectMode, setSelectMode]   = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy]       = useState(false)
  const [bulkMembers, setBulkMembers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/profiles', { cache: 'no-store' }).then(r => r.json())
      .then(d => setBulkMembers(Array.isArray(d) ? d.map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })) : []))
      .catch(() => {})
  }, [])
  const [search, setSearch]             = useState('')
  const [activeTask, setActiveTask]     = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [optimistic, setOptimistic]     = useState<Record<string, TaskStatus>>({})
  const [orderOverride, setOrderOverride] = useState<Record<string, string[]>>({}) // ordre local pendant un réordonnancement

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
  // Cartes récurrentes : masquées du Kanban tant que l'échéance est au-delà
  // de leur fenêtre d'apparition (lead_days). Elles restent visibles et
  // ouvrables dans le calendrier.
  const inLeadWindow = (t: Task): boolean => {
    if (!t.recurring_task_id || !t.deadline) return true
    const lead = t.recurring?.lead_days
    if (lead == null) return true
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const due = new Date(t.deadline + 'T00:00:00')
    const days = Math.ceil((due.getTime() - today.getTime()) / 86400000)
    return days <= lead
  }

  const visibleTasks = tasks
    .filter(inLeadWindow)
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

  const getColumnTasks = (status: TaskStatus) => {
    const cols = visibleTasks.filter(t => t.status === status)
    const override = orderOverride[status]
    if (override) {
      // Applique l'ordre local (optimiste) le temps que le serveur réponde.
      return [...cols].sort((a, b) => {
        const ia = override.indexOf(a.id), ib = override.indexOf(b.id)
        if (ia < 0 || ib < 0) return 0
        return ia - ib
      })
    }
    return cols
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTask(tasks.find(t => t.id === event.active.id) ?? null)
  }, [tasks])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const task = tasks.find(t => t.id === active.id)
    if (!task) return

    const overTask = tasks.find(t => t.id === over.id)
    const newStatus = TASK_STATUSES.includes(over.id as TaskStatus)
      ? (over.id as TaskStatus)
      : overTask?.status

    if (!newStatus) return

    // ── Cas 1 : réordonnancement DANS la même colonne ──────────────────────
    if (newStatus === task.status) {
      if (!overTask || overTask.id === task.id) return
      const column = tasks
        .filter(t => t.status === task.status && t.status !== 'Archivé')
        .sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999))
      const fromIdx = column.findIndex(t => t.id === task.id)
      const toIdx = column.findIndex(t => t.id === overTask.id)
      if (fromIdx < 0 || toIdx < 0) return
      const reordered = [...column]
      const [moved] = reordered.splice(fromIdx, 1)
      reordered.splice(toIdx, 0, moved)
      // Mise à jour optimiste de l'ordre local
      setOrderOverride(prev => ({ ...prev, [task.status]: reordered.map(t => t.id) }))
      try {
        await fetch('/api/tasks/reorder', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: task.status, orderedIds: reordered.map(t => t.id) }),
        })
        await refresh()
        setOrderOverride(prev => { const n = { ...prev }; delete n[task.status]; return n })
      } catch {
        toast.error('Erreur lors du réordonnancement')
        setOrderOverride(prev => { const n = { ...prev }; delete n[task.status]; return n })
      }
      return
    }

    // ── Cas 2 : changement de colonne (statut) ─────────────────────────────
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

  // ── Sélection multiple & actions groupées ──────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function exitSelectMode() { setSelectMode(false); setSelectedIds(new Set()) }

  async function runBulk(action: string, value?: string) {
    if (selectedIds.size === 0) return
    setBulkBusy(true)
    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds], action, value }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(`${data.count} carte${data.count > 1 ? 's' : ''} mise${data.count > 1 ? 's' : ''} à jour`)
      await refresh()
      exitSelectMode()
    } catch { toast.error('Action groupée impossible') }
    finally { setBulkBusy(false) }
  }

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
        <button
          onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
            selectMode
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
          )}
        >
          <CheckCircle2 className="w-3 h-3" />
          {selectMode ? 'Annuler' : 'Sélectionner'}
        </button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {TASK_STATUSES.map(status => (
            <KanbanColumn key={status} status={status} tasks={getColumnTasks(status)} onTaskClick={setSelectedTask}
              selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
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

      {/* Barre d'actions groupées */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-3 flex-wrap justify-center"
          style={{ boxShadow: '0 12px 40px rgba(20,22,40,0.18)' }}>
          <span className="text-sm font-semibold px-2">{selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}</span>
          <span className="w-px h-6 bg-border" />

          {/* Déplacer */}
          <select disabled={bulkBusy} defaultValue="" onChange={e => { if (e.target.value) runBulk('move', e.target.value); e.target.value = '' }}
            className="text-sm px-2.5 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50">
            <option value="" disabled>Déplacer vers…</option>
            {TASK_STATUSES.filter(s => s !== 'Archivé').map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>

          {/* Priorité */}
          <select disabled={bulkBusy} defaultValue="" onChange={e => { if (e.target.value) runBulk('priority', e.target.value); e.target.value = '' }}
            className="text-sm px-2.5 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50">
            <option value="" disabled>Priorité…</option>
            {['Urgent', 'Élevée', 'Moyenne', 'Faible'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Réassigner */}
          {bulkMembers.length > 0 && (
            <select disabled={bulkBusy} defaultValue="" onChange={e => { if (e.target.value) runBulk('assign', e.target.value); e.target.value = '' }}
              className="text-sm px-2.5 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50">
              <option value="" disabled>Assigner à…</option>
              {bulkMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}

          <button disabled={bulkBusy} onClick={() => runBulk('archive')}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50">
            <Archive className="w-3.5 h-3.5" /> Archiver
          </button>
          <button disabled={bulkBusy} onClick={() => { if (confirm(`Supprimer ${selectedIds.size} carte(s) ? Elles iront à la corbeille.`)) runBulk('delete') }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" /> Supprimer
          </button>
        </div>
      )}
    </>
  )
}