'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  X, Globe, Clock, MessageSquare, History,
  CheckSquare, Square, Paperclip, Tag, Building2,
  Send, Plus, Trash2
} from 'lucide-react'
import { cn, formatDeadline, isOverdue, getInitials } from '@/lib/utils'
import { useTaskStore } from '@/store/tasks'
import { PRIORITY_COLORS, STATUS_COLORS, TASK_STATUSES } from '@/types'
import type { Task, TaskStatus } from '@/types'
import { toast } from 'sonner'

interface Comment  { id: string; author: string; text: string; createdAt: string }
interface SubTask  { id: string; title: string; done: boolean }
interface HistoryEntry { id: string; author: string; action: string; createdAt: string }

interface TaskModalProps {
  task: Task
  open: boolean
  onClose: () => void
  currentUserName?: string
}

type Tab = 'details' | 'comments' | 'subtasks' | 'history'

export function TaskModal({ task, open, onClose, currentUserName }: TaskModalProps) {
  const { updateTask, moveTask } = useTaskStore()
  const [tab, setTab] = useState<Tab>('details')
  const [comments, setComments] = useState<Comment[]>([
    { id: 'c1', author: 'Manon M.', text: 'Shooting confirmé avec Studio Lumière pour le 18 juin.', createdAt: '2026-06-09T10:30:00Z' },
    { id: 'c2', author: 'Lucas D.', text: "Je prépare les moodboards d'ici vendredi.", createdAt: '2026-06-09T14:15:00Z' },
  ])
  const [newComment, setNewComment] = useState('')
  const [subtasks, setSubtasks] = useState<SubTask[]>([
    { id: 's1', title: 'Valider le brief créatif', done: true },
    { id: 's2', title: 'Envoyer les références visuelles', done: true },
    { id: 's3', title: 'Confirmer la date avec le studio', done: false },
    { id: 's4', title: 'Préparer les produits à shooter', done: false },
  ])
  const [newSubtask, setNewSubtask] = useState('')
  const [history] = useState<HistoryEntry[]>([
    { id: 'h1', author: 'Manon M.', action: 'a créé cette tâche', createdAt: '2026-06-07T09:00:00Z' },
    { id: 'h2', author: 'Lucas D.', action: 'a été assigné', createdAt: '2026-06-07T09:05:00Z' },
    { id: 'h3', author: 'Manon M.', action: 'a changé le statut : A Faire → En cours', createdAt: '2026-06-08T11:20:00Z' },
  ])

  if (!open) return null

  const deptColor = task.department?.color ?? '#94A3B8'
  const overdue = isOverdue(task.deadline)
  const doneSub = subtasks.filter(s => s.done).length

  function handleStatusChange(status: TaskStatus) {
    const oldStatus = task.status
    moveTask(task.id, status)
    updateTask(task.id, { status })
    if (status === 'Bloqué') {
      toast.error('⚠️ Tâche marquée Bloquée — le manager sera notifié')
    } else {
      toast.success(`Statut mis à jour : ${status}`)
    }
    if (task.assignees?.length && status !== oldStatus) {
      fetch('/api/notify/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignees: task.assignees.map(a => ({ name: a.name, email: a.email })),
          task: { title: task.title, description: task.description, priority: task.priority, deadline: task.deadline, status },
          oldStatus,
          department: { name: task.department?.name ?? '', color: task.department?.color ?? '#94A3B8' },
          changedByName: currentUserName ?? 'Utilisateur',
        }),
      }).catch(() => {})
    }
  }

  function submitComment() {
    if (!newComment.trim()) return
    const text = newComment.trim()
    setComments(prev => [...prev, {
      id: `c-${Date.now()}`, author: currentUserName ?? 'Utilisateur',
      text, createdAt: new Date().toISOString(),
    }])
    setNewComment('')
    if (task.assignees?.length) {
      fetch('/api/notify/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignees: task.assignees.map(a => ({ name: a.name, email: a.email })),
          comment: text,
          task: { title: task.title, description: task.description, priority: task.priority, deadline: task.deadline, status: task.status },
          department: { name: task.department?.name ?? '', color: task.department?.color ?? '#94A3B8' },
          authorName: currentUserName ?? 'Utilisateur',
        }),
      }).catch(() => {})
    }
  }

  function toggleSubtask(id: string) {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, done: !s.done } : s))
  }

  function addSubtask() {
    if (!newSubtask.trim()) return
    setSubtasks(prev => [...prev, { id: `s-${Date.now()}`, title: newSubtask.trim(), done: false }])
    setNewSubtask('')
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'details',  label: 'Détails',      icon: <Tag className="w-3.5 h-3.5" /> },
    { id: 'subtasks', label: 'Sous-tâches',  icon: <CheckSquare className="w-3.5 h-3.5" />, count: subtasks.length },
    { id: 'comments', label: 'Commentaires', icon: <MessageSquare className="w-3.5 h-3.5" />, count: comments.length },
    { id: 'history',  label: 'Historique',   icon: <History className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-card w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/10"
          style={{ borderTop: `3px solid ${deptColor}` }}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {task.is_cross_team && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full glass text-muted-foreground">
                  <Globe className="w-3 h-3" /> Inter-équipes
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${PRIORITY_COLORS[task.priority]}, ${PRIORITY_COLORS[task.priority]}99)` }}>
                {task.priority}
              </span>
              {task.department && (
                <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                  style={{ backgroundColor: `${deptColor}cc` }}>
                  {task.department.name}
                </span>
              )}
            </div>
            <h2 className="font-heading font-semibold text-xl leading-tight">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-white/10 overflow-x-auto">
          {TASK_STATUSES.map(s => (
            <button key={s} onClick={() => handleStatusChange(s)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-200 font-medium',
                task.status === s ? 'text-white shadow-md' : 'glass text-muted-foreground hover:text-foreground'
              )}
              style={task.status === s ? { background: STATUS_COLORS[s], boxShadow: `0 4px 12px ${STATUS_COLORS[s]}55` } : {}}>
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: task.status === s ? '#fff' : STATUS_COLORS[s] }} />
              {s}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors',
                tab === t.id ? 'border-current text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              style={tab === t.id ? { borderColor: deptColor, color: deptColor } : {}}>
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span className="text-xs px-1.5 py-0.5 rounded-full glass">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* DETAILS */}
          {tab === 'details' && (
            <div className="space-y-5">
              {task.description && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</p>
                  <p className="text-sm leading-relaxed text-foreground/80">{task.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {task.deadline && (
                  <div className="glass-card p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Échéance</p>
                    <p className={cn('text-sm font-semibold', overdue && 'text-red-500')}>
                      {format(parseISO(task.deadline), 'd MMMM yyyy', { locale: fr })}
                      {overdue && <span className="ml-1 text-xs font-normal">(en retard)</span>}
                    </p>
                  </div>
                )}
                {task.fournisseur_client && (
                  <div className="glass-card p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Fournisseur / Client</p>
                    <p className="text-sm font-semibold truncate">{task.fournisseur_client}</p>
                  </div>
                )}
                {task.ref_collection && (
                  <div className="glass-card p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Tag className="w-3 h-3" /> Collection</p>
                    <p className="text-sm font-semibold font-mono">{task.ref_collection}</p>
                  </div>
                )}
              </div>
              {task.assignees && task.assignees.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Assignés</p>
                  <div className="flex flex-wrap gap-2">
                    {task.assignees.map(user => (
                      <div key={user.id} className="flex items-center gap-2 glass-card px-3 py-1.5">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}88)` }}>
                          {getInitials(user.name)}
                        </div>
                        <span className="text-xs font-medium">{user.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {task.is_cross_team && task.extra_departments && task.extra_departments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Départements concernés</p>
                  <div className="flex flex-wrap gap-2">
                    {task.extra_departments.map(dept => (
                      <span key={dept.id} className="text-xs px-3 py-1.5 rounded-full text-white font-medium"
                        style={{ background: `linear-gradient(135deg, ${dept.color}dd, ${dept.color}88)` }}>
                        {dept.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pièces jointes</p>
                <label className="flex items-center gap-2 glass-card p-3 cursor-pointer hover:bg-white/10 transition-colors rounded-xl border-dashed">
                  <Paperclip className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Ajouter un fichier…</span>
                  <input type="file" className="hidden" multiple onChange={() => toast.info('Upload disponible en version connectée')} />
                </label>
              </div>
            </div>
          )}

          {/* SOUS-TÂCHES */}
          {tab === 'subtasks' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progression</p>
                  <span className="text-xs font-semibold" style={{ color: deptColor }}>{doneSub}/{subtasks.length}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${subtasks.length ? (doneSub / subtasks.length) * 100 : 0}%`, background: `linear-gradient(90deg, ${deptColor}, ${deptColor}99)` }} />
                </div>
              </div>
              <div className="space-y-2">
                {subtasks.map(sub => (
                  <div key={sub.id} className="flex items-center gap-3 glass-card p-3 group">
                    <button onClick={() => toggleSubtask(sub.id)} className="flex-shrink-0">
                      {sub.done
                        ? <CheckSquare className="w-4 h-4" style={{ color: deptColor }} />
                        : <Square className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <span className={cn('text-sm flex-1', sub.done && 'line-through text-muted-foreground')}>{sub.title}</span>
                    <button onClick={() => setSubtasks(p => p.filter(s => s.id !== sub.id))}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSubtask()}
                  placeholder="Ajouter une sous-tâche… (Entrée)"
                  className="flex-1 glass-card px-3 py-2 text-sm bg-transparent focus:outline-none rounded-xl" />
                <button onClick={addSubtask} disabled={!newSubtask.trim()}
                  className="p-2 rounded-xl text-white transition-all disabled:opacity-40"
                  style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}bb)` }}>
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* COMMENTAIRES */}
          {tab === 'comments' && (
            <div className="space-y-4">
              <div className="space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                      style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}77)` }}>
                      {getInitials(c.author)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs font-semibold">{c.author}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(c.createdAt), 'd MMM à HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <div className="glass-card px-3 py-2.5 text-sm leading-relaxed">{c.text}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}77)` }}>MM</div>
                <div className="flex-1 flex gap-2">
                  <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
                    placeholder="Écrire un commentaire… (Entrée pour envoyer)"
                    rows={2}
                    className="flex-1 glass-card px-3 py-2 text-sm bg-transparent focus:outline-none resize-none rounded-xl" />
                  <button onClick={submitComment} disabled={!newComment.trim()}
                    className="p-2 rounded-xl text-white self-end transition-all disabled:opacity-40"
                    style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}bb)` }}>
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* HISTORIQUE */}
          {tab === 'history' && (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={h.id} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: deptColor }} />
                    {i < history.length - 1 && <div className="w-px flex-1 bg-border mt-1" style={{ minHeight: 24 }} />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm">
                      <span className="font-semibold">{h.author}</span>
                      <span className="text-muted-foreground"> {h.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(h.createdAt), 'd MMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
