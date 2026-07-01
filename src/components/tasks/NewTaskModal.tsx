'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Search, ChevronDown, ChevronUp, CheckSquare, Paperclip, Trash2, FileText, Repeat } from 'lucide-react'
import { toast } from 'sonner'
import { getInitials } from '@/lib/utils'
import { createTask } from '@/lib/actions/tasks'
import { TASK_STATUSES, TASK_PRIORITIES } from '@/types'
import type { Department, Profile } from '@/types'

interface ProfileWithDept extends Profile {
  department?: Department
}

// Élément de checklist en attente (avant création de la carte)
interface DraftChecklistItem {
  id: string        // id temporaire local
  title: string
  group: string
}

interface NewTaskModalProps {
  open:                 boolean
  onClose:              () => void
  onCreated:            () => void
  currentDepartmentId:  string
  departments:          Department[]
  profile:              Profile
}

export function NewTaskModal({ open, onClose, onCreated, currentDepartmentId, departments, profile }: NewTaskModalProps) {
  const [allProfiles, setAllProfiles] = useState<ProfileWithDept[]>([])
  const [loading, setLoading]         = useState(false)
  const [search, setSearch]           = useState('')

  // Champs du formulaire
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus]           = useState('A Faire')
  const [priority, setPriority]       = useState('Moyenne')
  const [deadline, setDeadline]       = useState('')
  const [deptId, setDeptId]           = useState(currentDepartmentId)
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [fournisseur, setFournisseur] = useState('')
  const [refCollection, setRefCollection] = useState('')
  const [showAssignees, setShowAssignees] = useState(false)

  // Récurrence (optionnelle)
  const [isRecurring, setIsRecurring]   = useState(false)
  const [recFrequency, setRecFrequency] = useState('weekly')
  const [recWeekday, setRecWeekday]     = useState(0)
  const [recMonthDay, setRecMonthDay]   = useState(1)

  // Listes à cocher (groupées) à créer en même temps que la carte
  const [checklist, setChecklist]     = useState<DraftChecklistItem[]>([])
  const [newItemTitle, setNewItemTitle] = useState('')
  const [newItemGroup, setNewItemGroup] = useState('Général')

  // Fichiers à joindre dès la création
  const [files, setFiles]             = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modèles de cartes
  interface Template {
    id: string; name: string
    default_title: string | null; default_description: string | null
    default_priority: string | null; default_deadline_days: number | null
    default_subtasks: { title: string; group?: string }[] | null
    department_id: string | null
  }
  const [templates, setTemplates]     = useState<Template[]>([])
  const [savingTemplate, setSavingTemplate] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch('/api/profiles').then(r => r.json()).then(setAllProfiles).catch(() => {})
    fetch('/api/templates').then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : [])).catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) {
      setTitle(''); setDescription(''); setStatus('A Faire'); setPriority('Moyenne')
      setDeadline(''); setDeptId(currentDepartmentId); setAssigneeIds([])
      setFournisseur(''); setRefCollection(''); setSearch(''); setShowAssignees(false)
      setChecklist([]); setNewItemTitle(''); setNewItemGroup('Général'); setFiles([])
    }
  }, [open, currentDepartmentId])

  const filteredProfiles = allProfiles.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.department?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const byDept = filteredProfiles.reduce<Record<string, ProfileWithDept[]>>((acc, p) => {
    const key = p.department?.name ?? 'Sans département'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  function toggleAssignee(id: string) {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toast.error('Le titre est requis'); return }

    setLoading(true)
    const result = await createTask({
      title:             title.trim(),
      description:       description.trim() || undefined,
      status,
      priority,
      department_id:     deptId,
      deadline:          deadline || null,
      is_cross_team:     false,
      assignees:         assigneeIds,
      extra_departments: [],
      fournisseur_client: fournisseur.trim() || null,
      ref_collection:    refCollection.trim() || null,
    })

    if (!result.success) {
      setLoading(false)
      toast.error(result.error ?? 'Erreur lors de la création')
      return
    }

    const newTaskId = result.taskId
    // Si récurrence activée, enregistrer le modèle (cette carte = 1re occurrence).
    if (isRecurring) {
      try {
        await fetch('/api/recurring', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(), description: description.trim() || null, priority,
            department_id: deptId || null, frequency: recFrequency,
            weekday: recFrequency === 'weekly' ? recWeekday : null,
            month_day: recFrequency === 'monthly_day' ? recMonthDay : null,
            assignee_ids: assigneeIds, first_task_id: newTaskId,
          }),
        })
      } catch { /* la carte est créée même si le modèle échoue */ }
    }
    // Enregistrer les sous-tâches (listes à cocher) et les fichiers, si présents.
    if (newTaskId) {
      try {
        for (const item of checklist) {
          await fetch(`/api/tasks/${newTaskId}/subtasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: item.title, group_name: item.group }),
          })
        }
        for (const file of files) {
          const fd = new FormData()
          fd.append('file', file)
          await fetch(`/api/tasks/${newTaskId}/attachments`, { method: 'POST', body: fd })
        }
      } catch {
        // La carte est créée ; si un élément annexe échoue, on prévient sans bloquer.
        toast.error('Carte créée, mais un élément (liste/fichier) n\'a pas pu être ajouté')
      }

      // Notifier les personnes assignées (la route exclut l'auteur et
      // respecte les préférences de chacun).
      const assignedProfiles = allProfiles.filter(p => assigneeIds.includes(p.id))
      if (assignedProfiles.length) {
        fetch('/api/notify/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignees: assignedProfiles.map(p => ({ name: p.name, email: p.email })),
            task: { id: newTaskId, title: title.trim(), priority, deadline: deadline || null, is_cross_team: false },
            department: { name: departments.find(d => d.id === deptId)?.name ?? '', color: departments.find(d => d.id === deptId)?.color ?? '#94A3B8' },
            createdByName: profile.name?.split(' ')[0] ?? 'Un collègue',
          }),
        }).catch(() => {})
      }
    }

    setLoading(false)
    toast.success('Tâche créée !')
    onCreated()
    onClose()
  }

  function addChecklistItem() {
    const t = newItemTitle.trim()
    if (!t) return
    setChecklist(prev => [...prev, { id: crypto.randomUUID(), title: t, group: newItemGroup.trim() || 'Général' }])
    setNewItemTitle('')
  }

  function removeChecklistItem(id: string) {
    setChecklist(prev => prev.filter(i => i.id !== id))
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    setFiles(prev => [...prev, ...picked])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  function applyTemplate(templateId: string) {
    if (!templateId) return
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) return
    if (tpl.default_title) setTitle(tpl.default_title)
    if (tpl.default_description) setDescription(tpl.default_description)
    if (tpl.default_priority) setPriority(tpl.default_priority)
    if (tpl.department_id) setDeptId(tpl.department_id)
    if (typeof tpl.default_deadline_days === 'number') {
      const d = new Date(); d.setDate(d.getDate() + tpl.default_deadline_days)
      setDeadline(d.toISOString().slice(0, 10))
    }
    if (Array.isArray(tpl.default_subtasks) && tpl.default_subtasks.length) {
      setChecklist(tpl.default_subtasks.map(s => ({
        id: crypto.randomUUID(), title: s.title, group: s.group ?? 'Général',
      })))
    }
    toast.success(`Modèle « ${tpl.name} » appliqué`)
  }

  async function saveAsTemplate() {
    const name = window.prompt('Nom du modèle :', title.trim() || 'Nouveau modèle')
    if (!name?.trim()) return
    setSavingTemplate(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          default_title: title.trim() || null,
          default_description: description.trim() || null,
          default_priority: priority,
          department_id: deptId,
          default_subtasks: checklist.map(c => ({ title: c.title, group: c.group })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTemplates(prev => [...prev, { ...data, default_title: title, default_description: description, default_priority: priority, default_deadline_days: null, default_subtasks: checklist.map(c => ({ title: c.title, group: c.group })), department_id: deptId }])
      toast.success('Modèle enregistré')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSavingTemplate(false)
    }
  }

  if (!open) return null

  const selectedProfiles = allProfiles.filter(p => assigneeIds.includes(p.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-heading font-bold text-lg">Nouvelle tâche</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Appliquer un modèle */}
          {templates.length > 0 && (
            <div className="rounded-xl border border-dashed border-border p-2.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <FileText className="w-3.5 h-3.5" /> Partir d&apos;un modèle
              </label>
              <select
                onChange={e => applyTemplate(e.target.value)}
                defaultValue=""
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Aucun (carte vierge) —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Titre */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Titre <span className="text-destructive">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} required autoFocus
              placeholder="Titre de la tâche"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Détails, contexte, instructions…"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Statut + Priorité */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Statut</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none">
                {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Priorité</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none">
                {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Département + Échéance */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Département</label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none">
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Échéance</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Assignés */}
          <div>
            <button type="button" onClick={() => setShowAssignees(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
              <span className="font-medium">
                {assigneeIds.length === 0 ? 'Assigner des collaborateurs' : `${assigneeIds.length} collaborateur(s) assigné(s)`}
              </span>
              {showAssignees ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Avatars sélectionnés */}
            {assigneeIds.length > 0 && !showAssignees && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedProfiles.map(p => (
                  <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border"
                    style={{ borderColor: `${p.department?.color ?? '#94A3B8'}66`, color: p.department?.color }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: p.department?.color ?? '#94A3B8' }}>
                      {getInitials(p.name)}
                    </div>
                    {p.name}
                    <button type="button" onClick={() => toggleAssignee(p.id)} className="opacity-60 hover:opacity-100">×</button>
                  </div>
                ))}
              </div>
            )}

            {showAssignees && (
              <div className="mt-2 border border-border rounded-xl overflow-hidden">
                {/* Recherche */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
                  <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher un collaborateur…"
                    className="flex-1 text-sm bg-transparent focus:outline-none"
                    autoFocus
                  />
                </div>

                {/* Liste par département */}
                <div className="max-h-52 overflow-y-auto">
                  {Object.entries(byDept).map(([deptName, profiles]) => (
                    <div key={deptName}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20 sticky top-0">
                        {deptName}
                      </div>
                      {profiles.map(p => {
                        const selected = assigneeIds.includes(p.id)
                        return (
                          <button key={p.id} type="button" onClick={() => toggleAssignee(p.id)}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ backgroundColor: p.department?.color ?? '#94A3B8' }}>
                              {getInitials(p.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{p.role}</p>
                            </div>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${selected ? 'bg-primary border-primary' : 'border-border'}`}>
                              {selected && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                  {Object.keys(byDept).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucun résultat</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Champs métier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Fournisseur / Client</label>
              <input value={fournisseur} onChange={e => setFournisseur(e.target.value)} placeholder="Optionnel"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Réf. Collection</label>
              <input value={refCollection} onChange={e => setRefCollection(e.target.value)} placeholder="Optionnel"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Listes à cocher (groupées) */}
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
              <CheckSquare className="w-4 h-4" /> Listes à cocher
            </label>
            {checklist.length > 0 && (
              <div className="space-y-3 mb-2">
                {Object.entries(
                  checklist.reduce<Record<string, DraftChecklistItem[]>>((acc, item) => {
                    (acc[item.group] ??= []).push(item); return acc
                  }, {})
                ).map(([group, items]) => (
                  <div key={group} className="rounded-xl border border-border p-2.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{group}</p>
                    <div className="space-y-1">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <span className="w-3.5 h-3.5 rounded border border-border shrink-0" />
                          <span className="flex-1 truncate">{item.title}</span>
                          <button type="button" onClick={() => removeChecklistItem(item.id)}
                            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newItemGroup}
                onChange={e => setNewItemGroup(e.target.value)}
                placeholder="Liste"
                className="w-28 border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                value={newItemTitle}
                onChange={e => setNewItemTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
                placeholder="Ajouter un élément à cocher…"
                className="flex-1 border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button type="button" onClick={addChecklistItem}
                className="px-3 py-2 rounded-xl border border-border hover:bg-muted transition-colors shrink-0">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Change le nom de la liste pour créer plusieurs groupes (ex : Préparation, Validation).</p>
          </div>

          {/* Fichiers joints */}
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
              <Paperclip className="w-4 h-4" /> Fichiers
            </label>
            {files.length > 0 && (
              <div className="space-y-1 mb-2">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm rounded-lg border border-border px-2.5 py-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(0)} Ko` : `${(f.size / (1024 * 1024)).toFixed(1)} Mo`}
                    </span>
                    <button type="button" onClick={() => removeFile(idx)}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 cursor-pointer hover:bg-muted transition-colors text-sm text-muted-foreground">
              <Paperclip className="w-4 h-4" />
              Ajouter des fichiers…
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPickFiles} />
            </label>
          </div>

          {/* Récurrence */}
          <div className="border-t border-border pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded" style={{ accentColor: 'var(--accent)' }} />
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Repeat className="w-4 h-4 text-muted-foreground" /> Répéter cette carte automatiquement
              </span>
            </label>
            {isRecurring && (
              <div className="mt-3 pl-6 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fréquence</label>
                  <select value={recFrequency} onChange={e => setRecFrequency(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground">
                    <option value="weekly">Chaque semaine</option>
                    <option value="monthly_day">Jour fixe du mois</option>
                    <option value="monthly_first">Premier jour ouvré du mois</option>
                    <option value="monthly_last">Dernier jour ouvré du mois</option>
                    <option value="daily">Chaque jour ouvré</option>
                  </select>
                </div>
                {recFrequency === 'weekly' && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jour</label>
                    <div className="grid grid-cols-5 gap-1.5 mt-1">
                      {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map((d, i) => (
                        <button key={i} type="button" onClick={() => setRecWeekday(i)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${recWeekday === i ? 'text-white border-transparent' : 'border-border hover:bg-muted'}`}
                          style={recWeekday === i ? { backgroundColor: 'var(--accent)' } : {}}>{d}</button>
                      ))}
                    </div>
                  </div>
                )}
                {recFrequency === 'monthly_day' && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jour du mois (1–31)</label>
                    <input type="number" min={1} max={31} value={recMonthDay} onChange={e => setRecMonthDay(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">La carte d'aujourd'hui est créée maintenant ; les suivantes seront générées automatiquement.</p>
              </div>
            )}
          </div>

        </form>

        {/* Footer */}
        <div className="flex justify-between items-center gap-2 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={saveAsTemplate} disabled={savingTemplate || !title.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50">
            <FileText className="w-4 h-4" />
            Enregistrer comme modèle
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm rounded-xl border border-border hover:bg-muted transition-colors">
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={loading || !title.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium">
              <Plus className="w-4 h-4" />
              {loading ? 'Création…' : 'Créer la tâche'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}