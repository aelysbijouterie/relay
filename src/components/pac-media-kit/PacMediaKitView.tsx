'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskModal } from '@/components/tasks/TaskModal'
import { NewTaskModal } from '@/components/tasks/NewTaskModal'
import type { Task, Department, Profile } from '@/types'
import { OP_CATEGORY_LABELS, OP_CATEGORY_COLORS, PAC_MEDIA_KIT_DEPARTMENTS } from '@/types/pacMediaKit'
import type { OpCategory } from '@/types/pacMediaKit'

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

type CategoryFilter = 'all' | OpCategory

export function PacMediaKitView() {
  const [cursor, setCursor] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() })
  const [operations, setOperations] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/pac-media-kit', { cache: 'no-store' })
      const data = await res.json()
      setOperations(Array.isArray(data) ? data : [])
    } catch { /* noop */ }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // Profil + services, nécessaires pour ouvrir le formulaire de création
  // (NewTaskModal) directement depuis ce planning.
  useEffect(() => {
    (async () => {
      try {
        const [accRes, deptRes] = await Promise.all([
          fetch('/api/account', { cache: 'no-store' }),
          fetch('/api/departments', { cache: 'no-store' }),
        ])
        const acc = await accRes.json()
        const deptData: { id: string; name: string; color: string; slug: string }[] = await deptRes.json()
        setProfile(acc as Profile)
        setDepartments((deptData ?? []).map(d => ({ ...d, icon: null })))
      } catch { /* noop */ }
    })()
  }, [])

  // Service par défaut pour la création : le service actif de la personne
  // s'il fait partie de Marketing/Web, sinon le premier service autorisé.
  const defaultDeptId = useMemo(() => {
    const active = (profile as unknown as { active_department_id?: string })?.active_department_id
    const activeDept = departments.find(d => d.id === active)
    if (activeDept && PAC_MEDIA_KIT_DEPARTMENTS.includes(activeDept.slug)) return activeDept.id
    return departments.find(d => PAC_MEDIA_KIT_DEPARTMENTS.includes(d.slug))?.id ?? ''
  }, [profile, departments])

  function localDs(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const startDay = (first.getDay() + 6) % 7
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < startDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.y, cursor.m, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [cursor])

  const visibleOps = useMemo(
    () => filter === 'all' ? operations : operations.filter(o => o.op_category === filter),
    [operations, filter]
  )

  // Opérations actives à une date donnée : date_debut ≤ date ≤ deadline (date fin).
  // Si pas de date_debut renseignée, on ne compare que sur la date fin (deadline).
  function opsOnDay(date: Date): Task[] {
    const ds = localDs(date)
    return visibleOps.filter(o => {
      const end = o.deadline ? o.deadline.slice(0, 10) : null
      const start = o.op_date_debut ? o.op_date_debut.slice(0, 10) : end
      if (!start || !end) return false
      return ds >= start && ds <= end
    })
  }

  function prevMonth() { setCursor(c => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }) }
  function nextMonth() { setCursor(c => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }) }

  const todayStr = localDs(new Date())

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold mb-1 flex items-center gap-2">
            <Briefcase className="w-5 h-5" /> PAC &amp; Média Kit
          </h2>
          <p className="text-sm text-muted-foreground">
            Planning des opérations commerciales et média kit — Marketing &amp; Web
          </p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl text-white transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: 'var(--accent)' }}>
          <Plus className="w-4 h-4" /> Ajouter une opération
        </button>
      </div>

      {/* Filtre catégorie */}
      <div className="inline-flex rounded-lg border border-border overflow-hidden">
        <button onClick={() => setFilter('all')}
          className={cn('text-xs px-3 py-1.5 transition-colors', filter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
          Tout
        </button>
        {(Object.keys(OP_CATEGORY_LABELS) as OpCategory[]).map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={cn('text-xs px-3 py-1.5 transition-colors border-l border-border flex items-center gap-1.5',
              filter === c ? 'text-white' : 'hover:bg-muted')}
            style={filter === c ? { backgroundColor: OP_CATEGORY_COLORS[c] } : undefined}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: OP_CATEGORY_COLORS[c] }} />
            {OP_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Navigation mois */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
        <h3 className="font-semibold text-base">{MONTH_NAMES[cursor.m]} {cursor.y}</h3>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
      </div>

      {/* Grille calendrier */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAY_LABELS.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((date, i) => {
            if (!date) return <div key={i} className="min-h-[92px] border-b border-r border-border bg-muted/20" />
            const ds = localDs(date)
            const today = ds === todayStr
            const dayOps = opsOnDay(date)
            return (
              <div key={i} className={cn('min-h-[92px] p-1.5 border-b border-r border-border', today && 'bg-primary/5')}>
                <div className={cn('text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                  today && 'bg-primary text-primary-foreground')}>
                  {date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayOps.slice(0, 3).map(op => (
                    <button key={op.id} onClick={() => setSelectedTask(op)}
                      className="w-full text-left text-[0.62rem] leading-tight px-1.5 py-0.5 rounded truncate font-medium text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: OP_CATEGORY_COLORS[op.op_category as OpCategory] }}
                      title={op.title}>
                      {op.title}
                    </button>
                  ))}
                  {dayOps.length > 3 && <p className="text-[0.6rem] text-muted-foreground pl-1">+{dayOps.length - 3}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground text-center py-4">Chargement…</p>}
      {!loading && operations.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Aucune opération pour l&apos;instant. Crée une carte avec la catégorie « Opération commerciale » ou « Média Kit » pour qu&apos;elle apparaisse ici.
        </p>
      )}

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => { setSelectedTask(null); load() }}
        />
      )}

      {showNew && profile && departments.length > 0 && (
        <NewTaskModal
          open={showNew}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load() }}
          currentDepartmentId={defaultDeptId}
          departments={departments.filter(d => PAC_MEDIA_KIT_DEPARTMENTS.includes(d.slug))}
          profile={profile}
        />
      )}
    </div>
  )
}
