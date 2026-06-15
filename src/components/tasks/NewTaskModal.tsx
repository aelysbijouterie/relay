'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Plus, Globe, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { taskSchema, type TaskFormValues } from '@/lib/validations/task'
import { useTaskStore } from '@/store/tasks'
import { TASK_STATUSES, TASK_PRIORITIES } from '@/types'
import type { Department, Profile, Task } from '@/types'
import { DEMO_DEPARTMENTS, ALL_DEMO_MEMBERS } from '@/lib/demo-data'
import { createTask } from '@/lib/actions/tasks'
import { toast } from 'sonner'
import { getInitials } from '@/lib/utils'

interface NewTaskModalProps {
  open: boolean
  onClose: () => void
  currentDepartmentId: string
  departments: Department[]
  members: Profile[]
  profile: Profile
  isDemo?: boolean
}

export function NewTaskModal({
  open, onClose, currentDepartmentId, departments, members, profile, isDemo,
}: NewTaskModalProps) {
  const { addTask } = useTaskStore()
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({})
  const router = useRouter()

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      status:        'A Faire',
      priority:      'Moyenne',
      department_id: currentDepartmentId,
      is_cross_team: false,
      assignees:     [],
      extra_departments: [],
    },
  })

  const isCrossTeam      = watch('is_cross_team')
  const selectedDepts    = watch('extra_departments') ?? []
  const selectedAssignees = watch('assignees') ?? []

  // Membres des équipes extra sélectionnées
  const extraMembers: Record<string, Profile[]> = {}
  selectedDepts.forEach(deptId => {
    extraMembers[deptId] = ALL_DEMO_MEMBERS.filter(m => m.department_id === deptId)
  })

  function toggleAssignee(id: string) {
    const current = selectedAssignees
    setValue('assignees', current.includes(id) ? current.filter(x => x !== id) : [...current, id])
  }

  function toggleExtraDept(deptId: string) {
    const current = selectedDepts
    const next = current.includes(deptId) ? current.filter(x => x !== deptId) : [...current, deptId]
    setValue('extra_departments', next)
    // Retirer les assignés de cette équipe si on la déselectionne
    if (current.includes(deptId)) {
      const membersToRemove = ALL_DEMO_MEMBERS.filter(m => m.department_id === deptId).map(m => m.id)
      setValue('assignees', selectedAssignees.filter(id => !membersToRemove.includes(id)))
    }
  }

  const onSubmit = async (data: TaskFormValues) => {
    const dept = DEMO_DEPARTMENTS.find(d => d.id === data.department_id)
      ?? departments.find(d => d.id === data.department_id)

    const allMembers = [...members, ...ALL_DEMO_MEMBERS]
    const assignedMembers = allMembers.filter((m, i, arr) =>
      arr.findIndex(x => x.id === m.id) === i && (data.assignees ?? []).includes(m.id)
    )

    if (isDemo) {
      // ── Mode démo : Zustand uniquement ──────────────────────────
      const newTask: Task = {
        id:                `task-${Date.now()}`,
        title:             data.title,
        description:       data.description ?? null,
        status:            data.status,
        priority:          data.priority,
        department_id:     data.department_id,
        created_by:        profile.id,
        deadline:          data.deadline ?? null,
        is_cross_team:     data.is_cross_team ?? false,
        fournisseur_client: data.fournisseur_client ?? null,
        ref_collection:    data.ref_collection ?? null,
        parent_task_id:    null,
        created_at:        new Date().toISOString(),
        updated_at:        new Date().toISOString(),
        department:        dept,
        assignees:         assignedMembers,
        extra_departments: DEMO_DEPARTMENTS.filter(d => (data.extra_departments ?? []).includes(d.id)),
      }
      addTask(newTask)
    } else {
      // ── Mode réel : sauvegarde Supabase ──────────────────────────
      const result = await createTask(data)
      if (!result.success) {
        toast.error(result.error ?? 'Erreur lors de la création')
        return
      }
      toast.success('Tâche créée !')
      reset()
      onClose()
      router.refresh()
      return
    }

    toast.success('Tâche créée !')
    reset()
    onClose()

    if (assignedMembers.length > 0) {
      fetch('/api/notify/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignees: assignedMembers.map(m => ({ name: m.name, email: m.email })),
          task: { title: data.title, description: data.description, priority: data.priority, deadline: data.deadline, is_cross_team: data.is_cross_team ?? false },
          department: { name: dept?.name ?? '', color: dept?.color ?? '#94A3B8' },
          createdByName: profile.name,
        }),
      }).catch(() => {})
    }
  }

  if (!open) return null

  const currentDept = departments.find(d => d.id === currentDepartmentId)
  const otherDepts  = departments.filter(d => d.id !== currentDepartmentId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-heading font-bold text-lg">Nouvelle tâche</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">

          {/* Titre */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Titre <span className="text-destructive">*</span></label>
            <input
              {...register('title')}
              placeholder="Titre de la tâche"
              autoFocus
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Détails, contexte…"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
          </div>

          {/* Statut + Priorité */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Statut</label>
              <Controller name="status" control={control} render={({ field }) => (
                <select {...field} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none">
                  {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Priorité</label>
              <Controller name="priority" control={control} render={({ field }) => (
                <select {...field} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none">
                  {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )} />
            </div>
          </div>

          {/* Échéance */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Échéance</label>
            <input type="date" {...register('deadline')}
              className="border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
          </div>

          {/* Assignés — membres du département actuel */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Assignés — {currentDept?.name}</label>
            <div className="flex flex-wrap gap-2">
              {members.map(member => {
                const active = selectedAssignees.includes(member.id)
                return (
                  <button key={member.id} type="button" onClick={() => toggleAssignee(member.id)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-sm"
                    style={active ? { backgroundColor: currentDept?.color ?? '#FF6B35', borderColor: currentDept?.color, color: 'white' } : {}}
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: currentDept?.color ?? '#94A3B8' }}>
                      {getInitials(member.name)}
                    </div>
                    {member.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Toggle inter-équipes */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30 cursor-pointer select-none"
            onClick={() => setValue('is_cross_team', !isCrossTeam)}
          >
            <Controller name="is_cross_team" control={control} render={({ field }) => (
              <input type="checkbox" checked={field.value} onChange={field.onChange} id="cross_team" className="rounded w-4 h-4 cursor-pointer" onClick={e => e.stopPropagation()} />
            )} />
            <label htmlFor="cross_team" className="flex items-center gap-2 text-sm font-medium cursor-pointer flex-1">
              <Globe className="w-4 h-4" />
              Tâche inter-équipes
            </label>
          </div>

          {/* Sélection équipes + personnes inter-équipes */}
          {isCrossTeam && (
            <div className="space-y-3 border border-border rounded-xl p-4 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Équipes concernées + assignation</p>

              {otherDepts.map(dept => {
                const isSelected = selectedDepts.includes(dept.id)
                const deptMembers = ALL_DEMO_MEMBERS.filter(m => m.department_id === dept.id)
                const isExpanded  = expandedDepts[dept.id] ?? isSelected

                return (
                  <div key={dept.id} className="rounded-xl overflow-hidden border border-border">
                    {/* En-tête département */}
                    <button
                      type="button"
                      onClick={() => {
                        toggleExtraDept(dept.id)
                        setExpandedDepts(p => ({ ...p, [dept.id]: !isSelected || !p[dept.id] }))
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 transition-colors"
                      style={isSelected ? { backgroundColor: `${dept.color}22` } : { backgroundColor: 'transparent' }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                        <span className="text-sm font-medium">{dept.name}</span>
                        {isSelected && (
                          <span className="text-xs px-2 py-0.5 rounded-full text-white font-semibold"
                            style={{ backgroundColor: dept.color }}>
                            Sélectionnée
                          </span>
                        )}
                      </div>
                      {isExpanded
                        ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      }
                    </button>

                    {/* Membres de ce département */}
                    {(isExpanded || isSelected) && deptMembers.length > 0 && (
                      <div className="px-3 pb-3 pt-1 flex flex-wrap gap-2 border-t border-border/50">
                        {deptMembers.map(member => {
                          const isAssigned = selectedAssignees.includes(member.id)
                          return (
                            <button key={member.id} type="button"
                              onClick={() => {
                                // Sélectionner aussi le département si on assigne un membre
                                if (!selectedDepts.includes(dept.id)) toggleExtraDept(dept.id)
                                toggleAssignee(member.id)
                              }}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all"
                              style={isAssigned ? { backgroundColor: dept.color, borderColor: dept.color, color: 'white' } : {}}
                            >
                              <div className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                                style={{ backgroundColor: dept.color, fontSize: '0.6rem' }}>
                                {getInitials(member.name)}
                              </div>
                              <span>{member.name}</span>
                              <span className="opacity-70 capitalize">{member.role}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Champs métier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Fournisseur / Client</label>
              <input {...register('fournisseur_client')} placeholder="Optionnel"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Réf. Collection</label>
              <input {...register('ref_collection')} placeholder="Optionnel"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            </div>
          </div>

          {/* Résumé assignés */}
          {selectedAssignees.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border border-border">
              <div className="flex -space-x-1.5">
                {selectedAssignees.slice(0, 5).map(id => {
                  const m = ALL_DEMO_MEMBERS.find(x => x.id === id) ?? members.find(x => x.id === id)
                  if (!m) return null
                  const dept = departments.find(d => d.id === m.department_id)
                  return (
                    <div key={id} className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: dept?.color ?? '#94A3B8' }} title={m.name}>
                      {getInitials(m.name)}
                    </div>
                  )
                })}
              </div>
              <span className="text-xs text-muted-foreground">
                {selectedAssignees.length} personne{selectedAssignees.length > 1 ? 's' : ''} assignée{selectedAssignees.length > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm rounded-xl border border-border hover:bg-muted transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium">
              <Plus className="w-4 h-4" />
              Créer la tâche
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
