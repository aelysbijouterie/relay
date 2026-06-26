'use client'

import { useMemo, useState } from 'react'
import { Sparkles, AlertTriangle, Clock, CheckCircle2, Layers, CheckCheck } from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'
import { useTaskStore } from '@/store/tasks'
import { TaskModal } from '@/components/tasks/TaskModal'
import { focusOfDay, urgencyBucket, urgencyLabel, remainingSubtasks } from '@/lib/tasks/todoScore'
import { PRIORITY_COLORS } from '@/types'
import type { Task } from '@/types'
import { cn, getInitials } from '@/lib/utils'

const TONE_BG: Record<string, string> = { red: '#EF4444', orange: '#F97316', blue: '#3E8FCC', gray: '#94A3B8' }

// Raison pour laquelle la tâche est dans le focus (petit libellé explicatif).
function reasonFor(task: Task): { text: string; icon: typeof Clock; color: string } {
  const b = urgencyBucket(task.deadline)
  if (b === 'retard')     return { text: 'En retard — à traiter', icon: AlertTriangle, color: '#EF4444' }
  if (b === 'aujourdhui') return { text: 'Échéance aujourd’hui',  icon: Clock,         color: '#EF4444' }
  if (b === 'demain')     return { text: 'Échéance demain',       icon: Clock,         color: '#F97316' }
  if (b === 'cette_semaine') return { text: 'Échéance cette semaine', icon: Clock,     color: '#F97316' }
  const rem = remainingSubtasks(task)
  if (rem > 0 && rem <= 2) return { text: `Presque finie — ${rem} sous-tâche${rem > 1 ? 's' : ''} restante${rem > 1 ? 's' : ''}`, icon: CheckCheck, color: '#1F9D57' }
  if (rem > 2)             return { text: `Gros chantier — ${rem} sous-tâches`, icon: Layers, color: '#8B72C4' }
  return { text: 'À avancer', icon: Sparkles, color: '#3E8FCC' }
}

export function TodoView() {
  const { tasks } = useTasks()
  const currentUserId = useTaskStore((s: { currentUserId: string | null }) => s.currentUserId)
  const [selected, setSelected] = useState<Task | null>(null)
  const [limit, setLimit] = useState(6)

  const mine = useMemo(() => {
    if (!currentUserId) return []
    return tasks.filter(t =>
      (t.assignees ?? []).some(a => a.id === currentUserId) || t.created_by === currentUserId
    )
  }, [tasks, currentUserId])

  const focus = useMemo(() => focusOfDay(mine, limit), [mine, limit])

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        <h1 className="text-2xl font-extrabold tracking-tight">Focus du jour</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5 capitalize">{today}</p>

      {/* Curseur 5–7 */}
      <div className="flex items-center gap-3 mb-6 bg-card border border-border rounded-xl px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">Tâches du jour :</span>
        <div className="flex gap-1.5">
          {[5, 6, 7].map(n => (
            <button key={n} onClick={() => setLimit(n)}
              className={cn('w-9 h-9 rounded-lg text-sm font-bold transition-all',
                limit === n ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70')}
              style={limit === n ? { backgroundColor: 'var(--accent)' } : {}}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {focus.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Rien à traiter aujourd’hui. Profite&nbsp;!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {focus.map((task, idx) => {
            const deptColor = task.department?.color ?? '#94A3B8'
            const urg = urgencyLabel(task.deadline)
            const reason = reasonFor(task)
            const RIcon = reason.icon
            return (
              <button key={task.id} onClick={() => setSelected(task)}
                className="w-full text-left bg-card border border-border rounded-xl p-4 flex items-start gap-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <span className="w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center flex-shrink-0 text-white"
                  style={{ backgroundColor: 'var(--accent)' }}>{idx + 1}</span>
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: deptColor }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold mb-1.5">{task.title}</p>
                  {/* Raison de présence dans le focus */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <RIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: reason.color }} />
                    <span className="text-xs font-semibold" style={{ color: reason.color }}>{reason.text}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[0.65rem] px-2 py-0.5 rounded-md font-bold"
                      style={{ backgroundColor: `${PRIORITY_COLORS[task.priority]}1A`, color: PRIORITY_COLORS[task.priority] }}>
                      {task.priority}
                    </span>
                    <span className="text-[0.65rem] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">{task.status}</span>
                    {task.deadline && (
                      <span className="text-[0.65rem] px-2 py-0.5 rounded-md font-semibold text-white" style={{ backgroundColor: TONE_BG[urg.tone] }}>
                        {urg.text}
                      </span>
                    )}
                  </div>
                </div>
                {task.assignees && task.assignees.length > 0 && (
                  <div className="flex -space-x-1.5 flex-shrink-0">
                    {task.assignees.slice(0, 3).map(u => (
                      <div key={u.id} title={u.name}
                        className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[0.6rem] font-bold text-white"
                        style={{ backgroundColor: deptColor }}>
                        {getInitials(u.name)}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
          <p className="text-xs text-muted-foreground text-center pt-3">
            {mine.filter(t => t.status !== 'Terminé' && t.status !== 'Archivé').length} tâches au total · {focus.length} sélectionnées pour aujourd’hui
          </p>
        </div>
      )}

      {selected && <TaskModal task={selected} open={true} onClose={() => setSelected(null)} />}
    </div>
  )
}
