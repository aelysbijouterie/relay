'use client'

import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  X, Globe, Clock, MessageSquare, History,
  CheckSquare, Square, Paperclip, Tag, Building2,
  Send, Plus, Trash2, Loader2, Download,
} from 'lucide-react'
import { cn, formatDeadline, isOverdue, getInitials } from '@/lib/utils'
import { useTaskStore } from '@/store/tasks'
import { useTasks } from '@/hooks/useTasks'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { PRIORITY_COLORS, STATUS_COLORS, TASK_STATUSES } from '@/types'
import type { Task, TaskStatus } from '@/types'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────────
interface DBComment {
  id: string
  content: string
  created_at: string
  author: { id: string; name: string; avatar_url: string | null; department?: { color: string } | null }
}
interface DBSubtask {
  id: string
  title: string
  is_done: boolean
  created_at: string
}
interface DBAttachment {
  id: string
  file_name: string
  file_url: string
  file_size: number | null
  file_type: string | null
  created_at: string
}

interface TaskModalProps {
  task:            Task
  open:            boolean
  onClose:         () => void
  currentUserName?: string
}

type Tab = 'details' | 'subtasks' | 'comments' | 'attachments'

// ─── Composant ──────────────────────────────────────────────────────────────
export function TaskModal({ task, open, onClose, currentUserName }: TaskModalProps) {
  const { moveTask, updateTask: updateStoreTask } = useTaskStore()
  const { refresh } = useTasks()
  const currentUserId = useTaskStore(s => s.currentUserId)

  const [tab, setTab]           = useState<Tab>('details')
  const [saving, setSaving]     = useState(false)

  // Comments
  const [comments, setComments]       = useState<DBComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newComment, setNewComment]   = useState('')
  const [postingComment, setPostingComment] = useState(false)

  // Subtasks
  const [subtasks, setSubtasks]       = useState<DBSubtask[]>([])
  const [subtasksLoading, setSubtasksLoading] = useState(false)
  const [newSubtask, setNewSubtask]   = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)

  // Attachments
  const [attachments, setAttachments] = useState<DBAttachment[]>([])
  const [attachLoading, setAttachLoading] = useState(false)
  const [uploading, setUploading]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const taskId = task.id

  // Charger données au premier affichage de chaque onglet
  useEffect(() => {
    if (!open) return
    if (tab === 'comments' && comments.length === 0) {
      setCommentsLoading(true)
      fetch(`/api/tasks/${taskId}/comments`)
        .then(r => r.json()).then(d => setComments(Array.isArray(d) ? d : []))
        .finally(() => setCommentsLoading(false))
    }
    if (tab === 'subtasks' && subtasks.length === 0) {
      setSubtasksLoading(true)
      fetch(`/api/tasks/${taskId}/subtasks`)
        .then(r => r.json()).then(d => setSubtasks(Array.isArray(d) ? d : []))
        .finally(() => setSubtasksLoading(false))
    }
    if (tab === 'attachments' && attachments.length === 0) {
      setAttachLoading(true)
      fetch(`/api/tasks/${taskId}/attachments`)
        .then(r => r.json()).then(d => setAttachments(Array.isArray(d) ? d : []))
        .finally(() => setAttachLoading(false))
    }
  }, [open, tab, taskId]) // eslint-disable-line

  // Reset au changement de tâche
  useEffect(() => {
    setTab('details')
    setComments([])
    setSubtasks([])
    setAttachments([])
    setNewComment('')
    setNewSubtask('')
  }, [taskId])

  if (!open) return null

  const deptColor = task.department?.color ?? '#94A3B8'
  const overdue   = isOverdue(task.deadline)
  const doneSub   = subtasks.filter(s => s.is_done).length

  // ── Status change ────────────────────────────────────────────────────────
  async function handleStatusChange(status: TaskStatus) {
    if (status === task.status || saving) return
    const oldStatus = task.status
    setSaving(true)

    // Optimiste local
    moveTask(taskId, status)
    updateStoreTask(taskId, { status })

    try {
      await updateTaskStatus(taskId, status)
      await refresh()
      if (status === 'Bloqué') toast.error('Tâche bloquée — le manager sera notifié')
      else toast.success(`Statut : ${status}`)

      // Notification assignés
      if (task.assignees?.length) {
        fetch('/api/notify/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignees:     task.assignees.map(a => ({ name: a.name, email: a.email })),
            task:          { title: task.title, priority: task.priority, deadline: task.deadline, status },
            oldStatus,
            department:    { name: task.department?.name ?? '', color: deptColor },
            changedByName: currentUserName ?? 'Utilisateur',
          }),
        }).catch(() => {})
      }
    } catch {
      toast.error('Impossible de mettre à jour le statut')
      moveTask(taskId, oldStatus)
      updateStoreTask(taskId, { status: oldStatus })
    } finally {
      setSaving(false)
    }
  }

  // ── Comments ─────────────────────────────────────────────────────────────
  async function submitComment() {
    const text = newComment.trim()
    if (!text || postingComment) return
    setPostingComment(true)
    try {
      const res  = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setComments(prev => [...prev, data])
      setNewComment('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur commentaire')
    } finally {
      setPostingComment(false)
    }
  }

  // ── Subtasks ─────────────────────────────────────────────────────────────
  async function addSubtask() {
    const title = newSubtask.trim()
    if (!title || addingSubtask) return
    setAddingSubtask(true)
    try {
      const res  = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSubtasks(prev => [...prev, data])
      setNewSubtask('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur sous-tâche')
    } finally {
      setAddingSubtask(false)
    }
  }

  async function toggleSubtask(sub: DBSubtask) {
    const next = !sub.is_done
    setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, is_done: next } : s))
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_done: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, is_done: sub.is_done } : s))
      toast.error('Impossible de mettre à jour')
    }
  }

  async function deleteSubtask(id: string) {
    setSubtasks(prev => prev.filter(s => s.id !== id))
    try {
      await fetch(`/api/tasks/${taskId}/subtasks/${id}`, { method: 'DELETE' })
    } catch {
      toast.error('Suppression échouée')
    }
  }

  // ── Attachments ───────────────────────────────────────────────────────────
  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || uploading) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch(`/api/tasks/${taskId}/attachments`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAttachments(prev => [...prev, data])
      toast.success('Fichier joint !')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur upload')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'details',     label: 'Détails',      icon: <Tag className="w-3.5 h-3.5" /> },
    { id: 'subtasks',    label: 'Sous-tâches',  icon: <CheckSquare className="w-3.5 h-3.5" />, count: subtasks.length || undefined },
    { id: 'comments',   label: 'Commentaires', icon: <MessageSquare className="w-3.5 h-3.5" />, count: comments.length || undefined },
    { id: 'attachments', label: 'Fichiers',     icon: <Paperclip className="w-3.5 h-3.5" />, count: attachments.length || undefined },
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
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground mr-1 shrink-0" />}
          {TASK_STATUSES.map(s => (
            <button key={s} onClick={() => handleStatusChange(s)} disabled={saving}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-200 font-medium disabled:opacity-50',
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

          {/* ─── DÉTAILS ───────────────────────────────────────────────── */}
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
            </div>
          )}

          {/* ─── SOUS-TÂCHES ────────────────────────────────────────────── */}
          {tab === 'subtasks' && (
            <div className="space-y-4">
              {subtasksLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  {subtasks.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progression</p>
                        <span className="text-xs font-semibold" style={{ color: deptColor }}>{doneSub}/{subtasks.length}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(doneSub / subtasks.length) * 100}%`, background: `linear-gradient(90deg, ${deptColor}, ${deptColor}99)` }} />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {subtasks.map(sub => (
                      <div key={sub.id} className="flex items-center gap-3 glass-card p-3 group">
                        <button onClick={() => toggleSubtask(sub)} className="flex-shrink-0">
                          {sub.is_done
                            ? <CheckSquare className="w-4 h-4" style={{ color: deptColor }} />
                            : <Square className="w-4 h-4 text-muted-foreground" />}
                        </button>
                        <span className={cn('text-sm flex-1', sub.is_done && 'line-through text-muted-foreground')}>{sub.title}</span>
                        <button onClick={() => deleteSubtask(sub.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {subtasks.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucune sous-tâche</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addSubtask()}
                      placeholder="Ajouter une sous-tâche… (Entrée)"
                      className="flex-1 glass-card px-3 py-2 text-sm bg-transparent focus:outline-none rounded-xl" />
                    <button onClick={addSubtask} disabled={!newSubtask.trim() || addingSubtask}
                      className="p-2 rounded-xl text-white transition-all disabled:opacity-40"
                      style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}bb)` }}>
                      {addingSubtask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── COMMENTAIRES ───────────────────────────────────────────── */}
          {tab === 'comments' && (
            <div className="space-y-4">
              {commentsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <div className="space-y-3">
                    {comments.map(c => {
                      const color = c.author?.department?.color ?? deptColor
                      return (
                        <div key={c.id} className="flex gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                            style={{ background: `linear-gradient(135deg, ${color}, ${color}77)` }}>
                            {c.author?.avatar_url
                              ? <img src={c.author.avatar_url} alt={c.author.name} className="w-full h-full rounded-full object-cover" />
                              : getInitials(c.author?.name ?? '?')
                            }
                          </div>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-xs font-semibold">{c.author?.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(c.created_at), 'd MMM à HH:mm', { locale: fr })}
                              </span>
                            </div>
                            <div className="glass-card px-3 py-2.5 text-sm leading-relaxed">{c.content}</div>
                          </div>
                        </div>
                      )
                    })}
                    {comments.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucun commentaire</p>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-white/10">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}77)` }}>
                      {getInitials(currentUserName ?? '?')}
                    </div>
                    <div className="flex-1 flex gap-2">
                      <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
                        placeholder="Écrire un commentaire… (Entrée pour envoyer)"
                        rows={2}
                        className="flex-1 glass-card px-3 py-2 text-sm bg-transparent focus:outline-none resize-none rounded-xl" />
                      <button onClick={submitComment} disabled={!newComment.trim() || postingComment}
                        className="p-2 rounded-xl text-white self-end transition-all disabled:opacity-40"
                        style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}bb)` }}>
                        {postingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── PIÈCES JOINTES ─────────────────────────────────────────── */}
          {tab === 'attachments' && (
            <div className="space-y-4">
              {attachLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <div className="space-y-2">
                    {attachments.map(att => (
                      <div key={att.id} className="flex items-center gap-3 glass-card p-3">
                        <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{att.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatSize(att.file_size)}
                            {att.file_size ? ' · ' : ''}
                            {format(parseISO(att.created_at), 'd MMM yyyy', { locale: fr })}
                          </p>
                        </div>
                        <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                    {attachments.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucun fichier joint</p>
                    )}
                  </div>
                  <label className={cn(
                    'flex items-center gap-2 glass-card p-3 cursor-pointer hover:bg-white/10 transition-colors rounded-xl border-dashed',
                    uploading && 'opacity-50 cursor-not-allowed'
                  )}>
                    {uploading
                      ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      : <Paperclip className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-sm text-muted-foreground">
                      {uploading ? 'Upload en cours…' : 'Ajouter un fichier…'}
                    </span>
                    <input ref={fileInputRef} type="file" className="hidden" disabled={uploading} onChange={uploadFile} />
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
