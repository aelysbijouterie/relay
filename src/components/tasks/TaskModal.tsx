'use client'

import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  X, Globe, Clock, MessageSquare, History,
  CheckSquare, Square, Paperclip, Tag, Building2,
  Send, Plus, Trash2, Loader2, Download, Pencil, Archive, Copy, UserPlus,
} from 'lucide-react'
import { cn, formatDeadline, isOverdue, getInitials } from '@/lib/utils'
import { useTasks } from '@/hooks/useTasks'
import { useTaskStore } from '@/store/tasks'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { PRIORITY_COLORS, STATUS_COLORS, TASK_STATUSES } from '@/types'
import type { Task, TaskStatus } from '@/types'
import { toast } from 'sonner'

const PALETTE = ['#6366f1', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#9B59B6', '#14B8A6']

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
  group_name?: string
  created_at: string
  assignees?: { id: string; name: string; avatar_url?: string | null }[]
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

type Tab = 'details' | 'subtasks' | 'comments' | 'attachments' | 'history'

interface DBActivity {
  id: string
  type: string
  field: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
  actor: { id: string; name: string; avatar_url: string | null } | null
}

// ─── Composant ──────────────────────────────────────────────────────────────
export function TaskModal({ task, open, onClose, currentUserName }: TaskModalProps) {
  const { refresh } = useTasks()
  const currentUserId = useTaskStore(s => s.currentUserId)

  const [tab, setTab]           = useState<Tab>('details')
  const [saving, setSaving]     = useState(false)

  // Historique
  const [activity, setActivity] = useState<DBActivity[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  // Édition des détails
  const [editing, setEditing]   = useState(false)
  const [editTitle, setEditTitle]       = useState(task.title)
  const [editDesc, setEditDesc]         = useState(task.description ?? '')
  const [editPriority, setEditPriority] = useState(task.priority)
  const [editDeadline, setEditDeadline] = useState(task.deadline ?? '')
  const [editFournisseur, setEditFournisseur]     = useState(task.fournisseur_client ?? '')
  const [editRefCollection, setEditRefCollection] = useState(task.ref_collection ?? '')
  const [deleting, setDeleting] = useState(false)

  // Comments
  const [comments, setComments]       = useState<DBComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newComment, setNewComment]   = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [mentionables, setMentionables] = useState<{ id: string; name: string; email: string }[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null) // texte après @ en cours de frappe

  // Tags
  const [taskTags, setTaskTags]       = useState<{ id: string; name: string; color: string }[]>(task.tags ?? [])
  const [allTags, setAllTags]         = useState<{ id: string; name: string; color: string }[]>([])
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [newTagName, setNewTagName]   = useState('')

  // Subtasks
  const [subtasks, setSubtasks]       = useState<DBSubtask[]>([])
  const [subtasksLoading, setSubtasksLoading] = useState(false)
  const [newSubtask, setNewSubtask]   = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)

  // Assignés (carte) — éditables
  const [assignees, setAssignees]   = useState<{ id: string; name: string; avatar_url?: string | null }[]>(task.assignees ?? [])
  const [allMembers, setAllMembers] = useState<{ id: string; name: string; email: string; avatar_url?: string | null }[]>([])
  const [showAssignPicker, setShowAssignPicker] = useState(false)
  const [savingAssignees, setSavingAssignees] = useState(false)
  const [openAssignSub, setOpenAssignSub] = useState<string | null>(null) // id sous-tâche dont le picker est ouvert

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
    // Sous-tâches : chargées dès l'ouverture (affichées aussi dans l'onglet Détails)
    if ((tab === 'subtasks' || tab === 'details') && subtasks.length === 0 && !subtasksLoading) {
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
    if (tab === 'history') {
      setActivityLoading(true)
      fetch(`/api/tasks/${taskId}/activity`)
        .then(r => r.json()).then(d => setActivity(Array.isArray(d) ? d : []))
        .finally(() => setActivityLoading(false))
    }
  }, [open, tab, taskId]) // eslint-disable-line

  // Au montage : profils (pour @mentions) et liste des tags
  useEffect(() => {
    if (!open) return
    fetch('/api/profiles').then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setMentionables(d.map((p: { id: string; name: string; email: string }) => ({ id: p.id, name: p.name, email: p.email })))
          setAllMembers(d.map((p: { id: string; name: string; email: string; avatar_url?: string | null }) => ({ id: p.id, name: p.name, email: p.email, avatar_url: p.avatar_url ?? null })))
        }
      })
      .catch(() => {})
    fetch('/api/tags').then(r => r.json())
      .then(d => setAllTags(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [open])

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

    try {
      await updateTaskStatus(taskId, status)
      await refresh() // met à jour SWR → tout composant useTasks() se rafraîchit
      if (status === 'Bloqué') toast.error('Tâche bloquée — le manager sera notifié')
      else toast.success(`Statut : ${status}`)

      // Notification : assignés + créateur, sauf l'auteur, selon préférences (géré côté serveur)
      fetch('/api/notify/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          oldStatus,
          changedByName: currentUserName ?? 'Utilisateur',
        }),
      }).catch(() => {})
    } catch {
      toast.error('Impossible de mettre à jour le statut')
      await refresh() // restaure le statut depuis le serveur
    } finally {
      setSaving(false)
    }
  }

  // ── Comments ─────────────────────────────────────────────────────────────
  function onCommentChange(value: string) {
    setNewComment(value)
    // Détecte si l'utilisateur est en train de taper une mention (@ suivi de
    // lettres, en fin de texte) → ouvre le menu filtré.
    const m = value.match(/@([\p{L}\s]*)$/u)
    setMentionQuery(m ? m[1].toLowerCase() : null)
  }

  function insertMention(name: string) {
    // Remplace le "@xxx" en cours par "@Nom Complet "
    const next = newComment.replace(/@([\p{L}\s]*)$/u, `@${name} `)
    setNewComment(next)
    setMentionQuery(null)
  }

  const mentionSuggestions =
    mentionQuery === null ? [] :
    mentionables
      .filter(p => p.name.toLowerCase().includes(mentionQuery.trim()))
      .slice(0, 6)

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

      // Détection des @mentions sur le NOM COMPLET (et non le prénom), pour
      // lever toute ambiguïté entre homonymes (ex : deux "Audrey"). On notifie
      // uniquement la personne dont le nom complet exact apparaît après un @.
      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const mentioned = mentionables.filter(p =>
        new RegExp(`@${escapeRegex(p.name)}\\b`, 'i').test(text)
      )
      if (mentioned.length) {
        fetch('/api/notify/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mentioned: mentioned.map(m => ({ name: m.name, email: m.email })),
            comment: text,
            task: { id: taskId, title: task.title, priority: task.priority, status: task.status, deadline: task.deadline },
            department: task.department?.name ?? '',
            authorName: currentUserName ?? 'Un collègue',
          }),
        }).catch(() => {})
        toast.success(`${mentioned.length} personne(s) mentionnée(s) notifiée(s)`)
      }

      setNewComment('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur commentaire')
    } finally {
      setPostingComment(false)
    }
  }

  // ── Édition / archivage / suppression ─────────────────────────────────────
  // Droits d'affichage : créateur ou assigné. Avec la visibilité personnelle,
  // ce sont les seuls à voir la carte dans leur Kanban de toute façon. La
  // vraie barrière reste côté serveur (canMutateTask), qui autorise aussi
  // managers et admins.
  const canEdit =
    task.created_by === currentUserId ||
    (task.assignees ?? []).some(a => a.id === currentUserId)

  async function saveEdits() {
    setSaving(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:    editTitle.trim(),
          description: editDesc.trim() || null,
          priority: editPriority,
          deadline: editDeadline || null,
          fournisseur_client: editFournisseur.trim() || null,
          ref_collection:     editRefCollection.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await refresh()
      setEditing(false)
      toast.success('Carte modifiée')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function saveTags(next: { id: string; name: string; color: string }[]) {
    setTaskTags(next)
    try {
      await fetch(`/api/tasks/${taskId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: next.map(t => t.id) }),
      })
      await refresh()
    } catch {
      toast.error('Erreur lors de l\'enregistrement des étiquettes')
    }
  }

  function toggleTag(tag: { id: string; name: string; color: string }) {
    const has = taskTags.some(t => t.id === tag.id)
    saveTags(has ? taskTags.filter(t => t.id !== tag.id) : [...taskTags, tag])
  }

  async function createTag() {
    const name = newTagName.trim()
    if (!name) return
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: PALETTE[allTags.length % PALETTE.length] }),
      })
      const tag = await res.json()
      if (!res.ok) throw new Error(tag.error)
      setAllTags(prev => prev.some(t => t.id === tag.id) ? prev : [...prev, tag])
      saveTags([...taskTags, tag])
      setNewTagName('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  async function duplicateTask() {
    setSaving(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/duplicate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await refresh()
      toast.success('Carte dupliquée')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function archiveTask() {
    setSaving(true)
    try {
      await updateTaskStatus(taskId, 'Archivé' as TaskStatus)
      await refresh()
      toast.success('Carte archivée')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTaskNow() {
    setSaving(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await refresh()
      toast.success('Carte supprimée')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
      setDeleting(false)
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

  // Ajoute / retire un collaborateur d'une sous-tâche (plusieurs possibles).
  async function toggleSubtaskAssignee(sub: DBSubtask, member: { id: string; name: string; avatar_url?: string | null }) {
    const current = sub.assignees ?? []
    const isOn = current.some(a => a.id === member.id)
    const next = isOn ? current.filter(a => a.id !== member.id) : [...current, { id: member.id, name: member.name, avatar_url: member.avatar_url ?? null }]
    setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, assignees: next } : s))
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignees: next.map(a => a.id) }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, assignees: current } : s))
      toast.error('Impossible de modifier les assignés')
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

  // Ajoute / retire un collaborateur de la carte (sauvegarde immédiate).
  async function toggleAssignee(member: { id: string; name: string; avatar_url?: string | null }) {
    const isAssigned = assignees.some(a => a.id === member.id)
    const next = isAssigned
      ? assignees.filter(a => a.id !== member.id)
      : [...assignees, { id: member.id, name: member.name, avatar_url: member.avatar_url ?? null }]
    setAssignees(next)
    setSavingAssignees(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignees: next.map(a => a.id) }),
      })
      if (!res.ok) throw new Error()
      refresh()
    } catch {
      setAssignees(assignees) // rollback
      toast.error('Impossible de modifier les assignés')
    } finally {
      setSavingAssignees(false)
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
    { id: 'history',     label: 'Historique',   icon: <History className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border"
          style={{ borderTop: `3px solid ${deptColor}` }}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {task.is_cross_team && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
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
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={duplicateTask} disabled={saving}
              title="Dupliquer" className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50">
              <Copy className="w-4 h-4" />
            </button>
            {canEdit && task.status !== 'Archivé' && (
              <>
                <button onClick={() => { setEditing(true); setTab('details') }} disabled={saving}
                  title="Modifier" className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={archiveTask} disabled={saving}
                  title="Archiver" className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50">
                  <Archive className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleting(true)} disabled={saving}
                  title="Supprimer" className="p-2 rounded-xl hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500 disabled:opacity-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-border overflow-x-auto">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground mr-1 shrink-0" />}
          {TASK_STATUSES.map(s => (
            <button key={s} onClick={() => handleStatusChange(s)} disabled={saving}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-200 font-medium disabled:opacity-50',
                task.status === s ? 'text-white shadow-md' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
              style={task.status === s ? { background: STATUS_COLORS[s], boxShadow: `0 4px 12px ${STATUS_COLORS[s]}55` } : {}}>
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: task.status === s ? '#fff' : STATUS_COLORS[s] }} />
              {s}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5">
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
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ─── DÉTAILS ───────────────────────────────────────────────── */}
          {tab === 'details' && (
            <div className="space-y-5">
              {/* Formulaire d'édition (pleine largeur) */}
              {editing && (
                <div className="bg-card border p-4 space-y-3 rounded-xl" style={{ borderColor: `${deptColor}55` }}>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Titre</label>
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
                    <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priorité</label>
                      <select value={editPriority} onChange={e => setEditPriority(e.target.value as typeof editPriority)}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground">
                        {(['Urgent', 'Élevée', 'Moyenne', 'Faible'] as const).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Échéance</label>
                      <input type="date" value={editDeadline?.slice(0, 10) ?? ''} onChange={e => setEditDeadline(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fournisseur / Client</label>
                      <input value={editFournisseur} onChange={e => setEditFournisseur(e.target.value)} placeholder="Optionnel"
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Réf. Collection</label>
                      <input value={editRefCollection} onChange={e => setEditRefCollection(e.target.value)} placeholder="Optionnel"
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={() => { setEditing(false); setEditTitle(task.title); setEditDesc(task.description ?? ''); setEditPriority(task.priority); setEditDeadline(task.deadline ?? ''); setEditFournisseur(task.fournisseur_client ?? ''); setEditRefCollection(task.ref_collection ?? '') }}
                      className="px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-muted transition-colors">Annuler</button>
                    <button onClick={saveEdits} disabled={saving || !editTitle.trim()}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50 flex items-center gap-1.5"
                      style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}99)` }}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Enregistrer
                    </button>
                  </div>
                </div>
              )}

              {/* Disposition deux colonnes */}
              {!editing && (
              <div className="flex flex-col md:flex-row gap-6">
                {/* Colonne gauche : description + infos métier */}
                <div className="flex-1 min-w-0 space-y-5">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</p>
                    {task.description
                      ? <p className="text-sm leading-relaxed text-foreground/80">{task.description}</p>
                      : <p className="text-sm italic text-muted-foreground">Aucune description.</p>}
                  </div>

                  {/* Sous-tâches (résumé + progression) sous la description */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sous-tâches</p>
                    {subtasks.length > 0 ? (
                      <>
                        <div className="bg-card border border-border rounded-xl p-3 mb-2.5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-muted-foreground">Progression</span>
                            <span className="text-xs font-bold" style={{ color: deptColor }}>
                              {doneSub}/{subtasks.length} · {Math.round((doneSub / subtasks.length) * 100)}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${Math.max((doneSub / subtasks.length) * 100, 4)}%`, backgroundColor: deptColor }} />
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          {subtasks.map(sub => (
                            <div key={sub.id} className="flex items-center gap-2.5 py-1.5">
                              <button onClick={() => toggleSubtask(sub)} className="flex-shrink-0">
                                {sub.is_done
                                  ? <span className="w-[18px] h-[18px] rounded-md flex items-center justify-center text-white text-[11px]" style={{ backgroundColor: deptColor }}>✓</span>
                                  : <span className="w-[18px] h-[18px] rounded-md border-[1.5px] border-border block" />}
                              </button>
                              <span className={cn('text-sm', sub.is_done && 'line-through text-muted-foreground')}>{sub.title}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Aucune sous-tâche. <button onClick={() => setTab('subtasks')} className="font-medium hover:underline" style={{ color: deptColor }}>En ajouter</button></p>
                    )}
                    <div className="flex gap-2 mt-2.5">
                      <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addSubtask()}
                        placeholder="Ajouter une sous-tâche… (Entrée)"
                        className="flex-1 bg-background border border-border px-3 py-2 text-sm focus:outline-none rounded-xl" />
                      <button onClick={addSubtask} disabled={!newSubtask.trim() || addingSubtask}
                        className="p-2 rounded-xl text-white transition-all disabled:opacity-40"
                        style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}bb)` }}>
                        {addingSubtask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {(task.fournisseur_client || task.ref_collection) && (
                    <div className="grid grid-cols-2 gap-3">
                      {task.fournisseur_client && (
                        <div className="bg-card border border-border rounded-xl p-3">
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Fournisseur / Client</p>
                          <p className="text-sm font-semibold truncate">{task.fournisseur_client}</p>
                        </div>
                      )}
                      {task.ref_collection && (
                        <div className="bg-card border border-border rounded-xl p-3">
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Tag className="w-3 h-3" /> Collection</p>
                          <p className="text-sm font-semibold font-mono">{task.ref_collection}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Colonne droite : récap */}
                <div className="w-full md:w-56 flex-shrink-0 space-y-4">
                  {/* Assignés (éditables) */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Assigné à</p>
                    {assignees.length > 0 ? (
                      <div className="space-y-1.5 mb-2">
                        {assignees.map(user => (
                          <div key={user.id} className="flex items-center gap-2 group/asg">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[0.6rem] font-bold text-white flex-shrink-0"
                              style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}88)` }}>
                              {getInitials(user.name)}
                            </div>
                            <span className="text-sm font-medium truncate flex-1">{user.name}</span>
                            <button onClick={() => toggleAssignee(user)} disabled={savingAssignees}
                              className="opacity-0 group-hover/asg:opacity-100 text-muted-foreground hover:text-red-500 transition-all" title="Retirer">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground mb-2">Personne</p>}

                    <button onClick={() => setShowAssignPicker(v => !v)}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Plus className="w-3 h-3" /> Assigner
                    </button>

                    {showAssignPicker && (
                      <div className="mt-2 bg-card border border-border rounded-xl p-2 space-y-0.5 max-h-52 overflow-y-auto shadow-lg">
                        {allMembers.length === 0 && <p className="text-xs text-muted-foreground p-2">Chargement…</p>}
                        {allMembers.map(m => {
                          const active = assignees.some(a => a.id === m.id)
                          return (
                            <button key={m.id} onClick={() => toggleAssignee(m)} disabled={savingAssignees}
                              className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors', active ? 'bg-muted' : 'hover:bg-muted')}>
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[0.6rem] font-bold text-white flex-shrink-0"
                                style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}88)` }}>
                                {getInitials(m.name)}
                              </div>
                              <span className="text-sm flex-1 truncate">{m.name}</span>
                              {active && <span className="text-xs font-bold" style={{ color: deptColor }}>✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Échéance */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Échéance</p>
                    {task.deadline
                      ? <p className={cn('text-sm font-semibold flex items-center gap-1.5', overdue && 'text-red-500')}>
                          <Clock className="w-3.5 h-3.5" />
                          {format(parseISO(task.deadline), 'd MMMM yyyy', { locale: fr })}
                        </p>
                      : <p className="text-sm text-muted-foreground">Aucune</p>}
                  </div>

                  {/* Priorité */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Priorité</p>
                    <span className="inline-flex text-xs px-2.5 py-1 rounded-md font-bold"
                      style={{ backgroundColor: `${PRIORITY_COLORS[task.priority]}1A`, color: PRIORITY_COLORS[task.priority] }}>
                      {task.priority}
                    </span>
                  </div>

                  {/* Étiquettes */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Étiquettes</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {taskTags.map(tag => (
                        <span key={tag.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}55` }}>
                          {tag.name}
                          <button onClick={() => toggleTag(tag)} className="hover:opacity-70" title="Retirer"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                      <button onClick={() => setShowTagPicker(v => !v)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Plus className="w-3 h-3" /> Étiquette
                      </button>
                    </div>
                    {showTagPicker && (
                      <div className="mt-2 bg-card border border-border rounded-xl p-3 space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {allTags.map(tag => {
                            const active = taskTags.some(t => t.id === tag.id)
                            return (
                              <button key={tag.id} onClick={() => toggleTag(tag)}
                                className={cn('text-xs px-2 py-0.5 rounded-full font-medium transition-all', active ? 'ring-2' : 'opacity-70 hover:opacity-100')}
                                style={{ backgroundColor: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}55` }}>
                                {tag.name}
                              </button>
                            )
                          })}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <input value={newTagName} onChange={e => setNewTagName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createTag() } }}
                            placeholder="Créer une étiquette…"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
                          <button onClick={createTag} className="px-2.5 py-1.5 rounded-lg text-xs border border-border hover:bg-muted transition-colors">Créer</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Espace */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Espace</p>
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: deptColor }} />
                      {task.department?.name}
                    </span>
                  </div>

                  {/* Départements concernés (inter-équipes) */}
                  {task.is_cross_team && task.extra_departments && task.extra_departments.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Aussi concernés</p>
                      <div className="flex flex-wrap gap-1.5">
                        {task.extra_departments.map(dept => (
                          <span key={dept.id} className="text-xs px-2.5 py-1 rounded-full text-white font-medium"
                            style={{ backgroundColor: dept.color }}>
                            {dept.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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
                      <div key={sub.id} className="bg-card border border-border rounded-xl p-3 group relative">
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggleSubtask(sub)} className="flex-shrink-0">
                            {sub.is_done
                              ? <CheckSquare className="w-4 h-4" style={{ color: deptColor }} />
                              : <Square className="w-4 h-4 text-muted-foreground" />}
                          </button>
                          <span className={cn('text-sm flex-1', sub.is_done && 'line-through text-muted-foreground')}>{sub.title}</span>

                          {/* Avatars des assignés */}
                          <div className="flex -space-x-1.5">
                            {(sub.assignees ?? []).slice(0, 3).map(a => (
                              <div key={a.id} title={a.name}
                                className="w-5 h-5 rounded-full border-2 border-card flex items-center justify-center text-[0.5rem] font-bold text-white"
                                style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}88)` }}>
                                {getInitials(a.name)}
                              </div>
                            ))}
                          </div>

                          {/* Bouton assigner */}
                          <button onClick={() => setOpenAssignSub(openAssignSub === sub.id ? null : sub.id)}
                            className="flex-shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Assigner">
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>

                          <button onClick={() => deleteSubtask(sub.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Sélecteur d'assignés de la sous-tâche */}
                        {openAssignSub === sub.id && (
                          <div className="mt-2 ml-7 bg-muted/40 border border-border rounded-lg p-1.5 space-y-0.5 max-h-44 overflow-y-auto">
                            {allMembers.map(m => {
                              const on = (sub.assignees ?? []).some(a => a.id === m.id)
                              return (
                                <button key={m.id} onClick={() => toggleSubtaskAssignee(sub, m)}
                                  className={cn('w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-sm transition-colors', on ? 'bg-muted' : 'hover:bg-muted')}>
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[0.5rem] font-bold text-white flex-shrink-0"
                                    style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}88)` }}>
                                    {getInitials(m.name)}
                                  </div>
                                  <span className="flex-1 truncate">{m.name}</span>
                                  {on && <span className="text-xs font-bold" style={{ color: deptColor }}>✓</span>}
                                </button>
                              )
                            })}
                          </div>
                        )}
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
                      className="flex-1 bg-background border border-border px-3 py-2 text-sm focus:outline-none rounded-xl" />
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
                            <div className="bg-card border border-border px-3 py-2.5 text-sm leading-relaxed">{c.content}</div>
                          </div>
                        </div>
                      )
                    })}
                    {comments.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucun commentaire</p>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}77)` }}>
                      {getInitials(currentUserName ?? '?')}
                    </div>
                    <div className="flex-1 flex gap-2 relative">
                      {mentionSuggestions.length > 0 && (
                        <div className="absolute bottom-full mb-1 left-0 right-12 bg-card border border-border rounded-xl overflow-hidden z-10 shadow-lg">
                          {mentionSuggestions.map(p => (
                            <button key={p.id} type="button" onClick={() => insertMention(p.name)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[0.6rem] font-bold text-white flex-shrink-0"
                                style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}77)` }}>
                                {getInitials(p.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      <textarea value={newComment} onChange={e => onCommentChange(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && mentionSuggestions.length === 0) { e.preventDefault(); submitComment() } }}
                        placeholder="Écrire un commentaire… (tapez @ pour mentionner)"
                        rows={2}
                        className="flex-1 bg-background border border-border px-3 py-2 text-sm focus:outline-none resize-none rounded-xl" />
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
                      <div key={att.id} className="flex items-center gap-3 bg-card border border-border p-3">
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
                    'flex items-center gap-2 bg-card border border-border p-3 cursor-pointer hover:bg-muted transition-colors rounded-xl border-dashed',
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

          {tab === 'history' && (
            <div className="space-y-3">
              {activityLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : activity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune activité enregistrée pour l&apos;instant</p>
              ) : (
                <ol className="relative border-l border-border ml-2 space-y-4">
                  {activity.map(a => (
                    <li key={a.id} className="ml-4">
                      <span className="absolute -left-1.5 w-3 h-3 rounded-full" style={{ backgroundColor: deptColor }} />
                      <p className="text-sm">
                        <span className="font-medium">{a.actor?.name ?? 'Quelqu\'un'}</span>{' '}
                        {activityLabel(a)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(a.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation de suppression */}
      {deleting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={() => setDeleting(false)}>
          <div className="bg-card border border-border p-5 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold">Supprimer cette carte ?</h3>
            <p className="text-sm text-muted-foreground">Cette action est définitive. La carte et tout son contenu (sous-tâches, commentaires, fichiers, historique) seront supprimés.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleting(false)} className="px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-muted transition-colors">Annuler</button>
              <button onClick={deleteTaskNow} disabled={saving}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Libellé lisible d'une ligne d'historique selon son type.
function activityLabel(a: DBActivity): string {
  const FIELD_LABELS: Record<string, string> = {
    title: 'le titre', description: 'la description', priority: 'la priorité',
    deadline: "l'échéance", status: 'le statut',
    fournisseur_client: 'le fournisseur/client', ref_collection: 'la référence',
  }
  switch (a.type) {
    case 'created':    return 'a créé la carte'
    case 'status':     return `a changé le statut : ${a.old_value || '—'} → ${a.new_value || '—'}`
    case 'archived':   return 'a archivé la carte'
    case 'comment':    return 'a ajouté un commentaire'
    case 'subtask':    return `a modifié les sous-tâches (${a.new_value ?? ''})`
    case 'attachment': return 'a joint un fichier'
    case 'assignees':  return `a modifié les assignations (${a.new_value ?? ''})`
    case 'field':      return `a modifié ${FIELD_LABELS[a.field ?? ''] ?? a.field}${a.new_value ? ` : ${a.new_value}` : ''}`
    default:           return 'a modifié la carte'
  }
}