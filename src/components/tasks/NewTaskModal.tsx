'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { getInitials } from '@/lib/utils'
import { createTask } from '@/lib/actions/tasks'
import { TASK_STATUSES, TASK_PRIORITIES } from '@/types'
import type { Department, Profile } from '@/types'

interface ProfileWithDept extends Profile {
  department?: Department
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

  useEffect(() => {
    if (!open) return
    fetch('/api/profiles').then(r => r.json()).then(setAllProfiles).catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) {
      setTitle(''); setDescription(''); setStatus('A Faire'); setPriority('Moyenne')
      setDeadline(''); setDeptId(currentDepartmentId); setAssigneeIds([])
      setFournisseur(''); setRefCollection(''); setSearch(''); setShowAssignees(false)
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
    setLoading(false)

    if (!result.success) {
      toast.error(result.error ?? 'Erreur lors de la création')
      return
    }

    toast.success('Tâche créée !')
    onCreated()
    onClose()
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

        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
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
  )
}
