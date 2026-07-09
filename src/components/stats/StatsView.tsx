'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { AlertTriangle, CheckCircle2, Clock, Users, TrendingUp, TrendingDown, User } from 'lucide-react'
import { isOverdue, cn } from '@/lib/utils'
import { PRIORITY_COLORS, STATUS_COLORS, STATUS_LABELS } from '@/types'
import { useTasks } from '@/hooks/useTasks'
import type { Task } from '@/types'

interface StatsViewProps {
  canSeeTeam: boolean
  deptName: string | null
  deptColor: string
}

type Scope = 'personal' | 'team'

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then(r => r.json()).then(d => (Array.isArray(d) ? d : []))

export function StatsView({ canSeeTeam, deptName, deptColor }: StatsViewProps) {
  const [scope, setScope] = useState<Scope>('personal')

  // Vue personnelle : tâches déjà visibles (créées + assignées) via le cache SWR partagé.
  const { tasks: personalTasks } = useTasks()

  // Vue équipe : chargée à la demande, uniquement si l'utilisateur peut la voir
  // et a sélectionné l'onglet. Clé null = SWR ne fetch pas.
  const { data: teamTasks, isLoading: teamLoading } = useSWR<Task[]>(
    canSeeTeam && scope === 'team' ? '/api/stats/team' : null,
    fetcher
  )

  const activeTasks = scope === 'team' ? (teamTasks ?? []) : personalTasks

  const stats = useMemo(() => computeStats(activeTasks), [activeTasks])

  const maxTasks  = Math.max(...stats.byPerson.map(p => p.tasks), 1)
  const maxStatus = Math.max(...stats.byStatus.map(s => s.count), 1)

  const kpis = [
    { label: 'Tâches actives', value: stats.active.length, icon: <Clock className="w-5 h-5" />, color: '#3B82F6', sub: `dont ${stats.blocked.length} bloquée${stats.blocked.length > 1 ? 's' : ''}` },
    { label: 'Terminées',      value: stats.done.length,   icon: <CheckCircle2 className="w-5 h-5" />, color: '#10B981', sub: 'au total' },
    { label: 'En retard',      value: stats.overdue.length, icon: <AlertTriangle className="w-5 h-5" />, color: stats.overdue.length > 0 ? '#EF4444' : '#10B981', sub: `${stats.overdueRate}% du total actif` },
    { label: 'Inter-équipes',  value: stats.crossTeam, icon: <Users className="w-5 h-5" />, color: '#9B59B6', sub: "avec d'autres services" },
  ]

  const subtitle = scope === 'team'
    ? (deptName ? `Vue équipe — ${deptName}` : "Vue équipe")
    : 'Vue personnelle — mes tâches'

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold mb-1">Statistiques</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {canSeeTeam && (
          <div className="inline-flex rounded-lg border border-border overflow-hidden self-start">
            <button
              onClick={() => setScope('personal')}
              className={cn('text-sm px-3 py-1.5 flex items-center gap-1.5 transition-colors',
                scope === 'personal' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            >
              <User className="w-3.5 h-3.5" /> Moi
            </button>
            <button
              onClick={() => setScope('team')}
              className={cn('text-sm px-3 py-1.5 flex items-center gap-1.5 transition-colors',
                scope === 'team' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            >
              <Users className="w-3.5 h-3.5" /> Mon équipe
            </button>
          </div>
        )}
      </div>

      {scope === 'team' && teamLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Chargement des données de l&apos;équipe…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map(kpi => (
              <div key={kpi.label} className="bg-card border border-border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${kpi.color}22`, color: kpi.color }}>{kpi.icon}</div>
                </div>
                <p className="text-3xl font-bold font-heading" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Charge par personne — surtout pertinent en vue équipe */}
            <div className="bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4" style={{ color: deptColor }} />
                <h3 className="font-semibold text-sm">
                  {scope === 'team' ? 'Charge de travail par membre' : 'Mes assignations'}
                </h3>
              </div>
              {stats.byPerson.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-4">Aucune tâche assignée</p>
                : (
                  <div className="space-y-3">
                    {stats.byPerson.sort((a, b) => b.tasks - a.tasks).map(person => (
                      <div key={person.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{person.name}</span>
                          <div className="flex items-center gap-2">
                            {person.overdue > 0 && (
                              <span className="text-xs text-red-500 font-medium flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" /> {person.overdue} en retard
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">{person.tasks} tâche{person.tasks > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${(person.tasks / maxTasks) * 100}%`,
                              background: person.overdue > 0
                                ? 'linear-gradient(90deg, #EF4444, #F97316)'
                                : `linear-gradient(90deg, ${deptColor}, ${deptColor}99)`,
                            }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* Par statut */}
            <div className="bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4" style={{ color: deptColor }} />
                <h3 className="font-semibold text-sm">Répartition par statut</h3>
              </div>
              <div className="space-y-3">
                {stats.byStatus.map(s => (
                  <div key={s.status}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-sm">{STATUS_LABELS[s.status as keyof typeof STATUS_LABELS] ?? s.status}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">{s.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(s.count / maxStatus) * 100}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Taux retard */}
            <div className="bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <h3 className="font-semibold text-sm">Taux de retard</h3>
              </div>
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none"
                      stroke={stats.overdueRate > 30 ? '#EF4444' : stats.overdueRate > 15 ? '#F97316' : '#10B981'}
                      strokeWidth="3"
                      strokeDasharray={`${stats.overdueRate} ${100 - stats.overdueRate}`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold">{stats.overdueRate}%</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{stats.overdue.length}</span> tâche{stats.overdue.length > 1 ? 's' : ''} en retard
                    <br />sur <span className="font-semibold text-foreground">{stats.active.length}</span> actives
                  </p>
                  <p className={`text-xs font-medium flex items-center gap-1 ${stats.overdueRate > 20 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {stats.overdueRate > 20
                      ? <><TrendingDown className="w-3 h-3" /> Attention requise</>
                      : <><TrendingUp className="w-3 h-3" /> Dans les normes</>}
                  </p>
                </div>
              </div>
            </div>

            {/* Par priorité */}
            <div className="bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4" style={{ color: deptColor }} />
                <h3 className="font-semibold text-sm">Tâches par priorité</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {stats.byPriority.map(p => (
                  <div key={p.priority} className="bg-card border border-border p-3 text-center">
                    <p className="text-2xl font-bold font-heading" style={{ color: p.color }}>{p.count}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.priority}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function computeStats(tasks: Task[]) {
  const active = tasks.filter(t => t.status !== 'Archivé')
  const overdue = active.filter(t => isOverdue(t.deadline))
  const done = tasks.filter(t => t.status === 'Terminé')
  const blocked = tasks.filter(t => t.status === 'Bloqué')
  const overdueRate = active.length ? Math.round((overdue.length / active.length) * 100) : 0
  const crossTeam = tasks.filter(t => t.is_cross_team).length

  const byPerson: Record<string, { name: string; tasks: number; overdue: number }> = {}
  active.forEach(task => {
    task.assignees?.forEach(user => {
      if (!byPerson[user.id]) byPerson[user.id] = { name: user.name, tasks: 0, overdue: 0 }
      byPerson[user.id].tasks++
      if (isOverdue(task.deadline)) byPerson[user.id].overdue++
    })
  })

  const byStatus = ['A Faire', 'En cours', 'Bloqué', 'A revoir', 'Terminé'].map(s => ({
    status: s, count: tasks.filter(t => t.status === s).length,
    color: STATUS_COLORS[s as keyof typeof STATUS_COLORS],
  }))

  const byPriority = ['Urgent', 'Élevée', 'Moyenne', 'Faible'].map(p => ({
    priority: p, count: active.filter(t => t.priority === p).length,
    color: PRIORITY_COLORS[p as keyof typeof PRIORITY_COLORS],
  }))

  return { active, overdue, done, blocked, overdueRate, crossTeam, byPerson: Object.values(byPerson), byStatus, byPriority }
}