'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isSameDay, isToday, isSameMonth, addMonths, subMonths,
  startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Palmtree } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { TaskModal } from '@/components/tasks/TaskModal'
import { useTasks } from '@/hooks/useTasks'
import { useTaskStore } from '@/store/tasks'
import type { Task } from '@/types'
import { holidayName, schoolHolidayName } from '@/lib/calendar/holidays'
import { occurrencesInRange } from '@/lib/recurring/schedule'
import type { RecurringTask } from '@/types/recurring'
import { FREQUENCY_LABELS, WEEKDAYS } from '@/types/recurring'
import { EventModal } from './EventModal'
import { CATEGORY_LABELS, CATEGORY_COLORS, eventOccursOn, dsLocal as dsLocalEvt, type CalendarEvent } from '@/types/calendarEvents'
import { Plus } from 'lucide-react'

// Décrit la règle de récurrence en clair.
function describeRecurrence(m: RecurringTask): string {
  if (m.frequency === 'weekly' && m.weekday != null) return `Chaque ${WEEKDAYS[m.weekday].toLowerCase()}`
  if (m.frequency === 'monthly_day' && m.month_day != null) return `Le ${m.month_day} de chaque mois`
  return FREQUENCY_LABELS[m.frequency]
}

// Date → 'YYYY-MM-DD' en heure locale (pour comparer aux tables de fériés).
function dsLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
type ViewMode = 'month' | 'week' | 'day'

export function CalendarView() {
  const { tasks, refresh } = useTasks()
  const currentUserId = useTaskStore(s => s.currentUserId)

  // Confidentialité : dans le calendrier, chacun ne voit QUE ses propres tâches
  // (assigné ou créateur). Le partage entre services ne concerne que le tableau
  // des congés, pas les tâches.
  const myTasks = useMemo(() =>
    tasks.filter(t =>
      !currentUserId // pas encore hydraté : on n'affiche rien de plus large
        ? false
        : (t.assignees ?? []).some(a => a.id === currentUserId) || t.created_by === currentUserId
    ), [tasks, currentUserId])
  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState(new Date())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showHol, setShowHol] = useState(true)
  const [showSchool, setShowSchool] = useState(true)
  const [recurring, setRecurring] = useState<RecurringTask[]>([])
  const [selectedRecurring, setSelectedRecurring] = useState<{ model: RecurringTask; date: string } | null>(null)
  const [showAbs, setShowAbs] = useState(false)
  const [absences, setAbsences] = useState<{ id: string; type: string; start_date: string; end_date: string; status: string; user?: { name?: string } }[]>([])
  const [materializing, setMaterializing] = useState(false)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [showEventModal, setShowEventModal] = useState<{ date?: Date; event?: CalendarEvent } | null>(null)

  async function loadEvents() {
    try {
      const r = await fetch('/api/calendar-events', { cache: 'no-store' })
      const d = await r.json()
      setEvents(Array.isArray(d) ? d : [])
    } catch { /* noop */ }
  }
  useEffect(() => { loadEvents() }, [])

  // Événements du mois affiché, groupés par jour.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    const from = startOfMonth(cursor); const to = endOfMonth(cursor)
    const cur = new Date(from)
    while (cur <= to) {
      const ds = dsLocalEvt(cur)
      const matches = events.filter(e => eventOccursOn(e, cur))
      if (matches.length) map.set(ds, matches)
      cur.setDate(cur.getDate() + 1)
    }
    return map
  }, [events, cursor])

  useEffect(() => {
    fetch('/api/recurring', { cache: 'no-store' }).then(r => r.json())
      .then(d => setRecurring(Array.isArray(d)
        ? d.filter((m: RecurringTask) =>
            m.is_active && (
              !currentUserId
                ? false
                : (m.assignee_ids ?? []).includes(currentUserId) || m.created_by === currentUserId
            ))
        : []))
      .catch(() => {})
  }, [currentUserId])

  // MES congés validés (si l'option est activée dans le profil) — jamais ceux
  // des collègues : le calendrier des tâches reste strictement personnel.
  useEffect(() => {
    if (!showAbs || !currentUserId) { setAbsences([]); return }
    fetch('/api/absences', { cache: 'no-store' }).then(r => r.json())
      .then(d => setAbsences(Array.isArray(d)
        ? d.filter((a: { status: string; user_id: string }) => a.status === 'Validé' && a.user_id === currentUserId)
        : []))
      .catch(() => {})
  }, [showAbs, currentUserId])

  // Mes absences par jour pour le mois affiché.
  const absencesByDay = useMemo(() => {
    const map = new Map<string, { name: string; type: string }[]>()
    if (!showAbs || absences.length === 0) return map
    const from = startOfMonth(cursor); const to = endOfMonth(cursor)
    for (const a of absences) {
      const start = a.start_date > dsLocal(from) ? new Date(a.start_date + 'T00:00:00') : from
      const end = a.end_date < dsLocal(to) ? new Date(a.end_date + 'T00:00:00') : to
      const cur = new Date(start)
      while (cur <= end) {
        const key = dsLocal(cur)
        const arr = map.get(key) ?? []
        arr.push({ name: a.user?.name ?? '?', type: a.type })
        map.set(key, arr)
        cur.setDate(cur.getDate() + 1)
      }
    }
    return map
  }, [absences, cursor, showAbs])

  // Projections des occurrences récurrentes pour le mois affiché.
  // Clé = 'YYYY-MM-DD' → liste des modèles dont une occurrence tombe ce jour.
  const projectionsByDay = useMemo(() => {
    const map = new Map<string, RecurringTask[]>()
    const from = startOfMonth(cursor)
    const to = endOfMonth(cursor)
    for (const m of recurring) {
      // Respect de l'horizon : ne pas projeter au-delà de horizon_months.
      if (m.horizon_months != null) {
        const limit = new Date()
        limit.setMonth(limit.getMonth() + m.horizon_months)
        if (from > limit) continue
      }
      const dates = occurrencesInRange(m.frequency, { weekday: m.weekday, month_day: m.month_day }, from, to)
      for (const ds of dates) {
        const arr = map.get(ds) ?? []
        arr.push(m)
        map.set(ds, arr)
      }
    }
    return map
  }, [recurring, cursor])

  useEffect(() => {
    function loadPrefs() {
      fetch('/api/account', { cache: 'no-store' }).then(r => r.json()).then(d => {
        setShowHol(d?.show_holidays ?? true)
        setShowAbs(d?.show_absences_calendar ?? false)
        setShowSchool(d?.show_school_holidays ?? true)
      }).catch(() => {})
    }
    loadPrefs()
    // Recharge aussi quand on revient sur l'onglet (ex : après avoir changé
    // l'option dans "Mon compte" puis être revenu sur le calendrier).
    function onVisible() { if (document.visibilityState === 'visible') loadPrefs() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', loadPrefs)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', loadPrefs)
    }
  }, [])

  // Crée MAINTENANT la carte d'une occurrence récurrente et l'ouvre en entier.
  async function materializeAndOpen() {
    if (!selectedRecurring) return
    setMaterializing(true)
    try {
      const r = await fetch(`/api/recurring/${selectedRecurring.model.id}/materialize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedRecurring.date }),
      })
      const d = await r.json()
      if (!r.ok || !d.task) throw new Error(d.error)
      await refresh()
      setSelectedRecurring(null)
      setSelectedTask(d.task as Task)
      if (d.created) toast.success('Carte ouverte — elle apparaîtra dans le Kanban à l\'approche de sa date')
    } catch { toast.error('Création impossible') }
    finally { setMaterializing(false) }
  }

  const tasksForDay = (day: Date) =>
    myTasks.filter(t => t.deadline && isSameDay(parseISO(t.deadline), day))

  // Titre + navigation dépendent de la vue
  const { title, goPrev, goNext } = useMemo(() => {
    if (view === 'month') {
      return {
        title: format(cursor, 'MMMM yyyy', { locale: fr }),
        goPrev: () => setCursor(c => subMonths(c, 1)),
        goNext: () => setCursor(c => addMonths(c, 1)),
      }
    }
    if (view === 'week') {
      const ws = startOfWeek(cursor, { weekStartsOn: 1 })
      const we = endOfWeek(cursor, { weekStartsOn: 1 })
      const sameMonth = isSameMonth(ws, we)
      return {
        title: sameMonth
          ? `${format(ws, 'd', { locale: fr })} – ${format(we, 'd MMMM yyyy', { locale: fr })}`
          : `${format(ws, 'd MMM', { locale: fr })} – ${format(we, 'd MMM yyyy', { locale: fr })}`,
        goPrev: () => setCursor(c => subWeeks(c, 1)),
        goNext: () => setCursor(c => addWeeks(c, 1)),
      }
    }
    return {
      title: format(cursor, 'EEEE d MMMM yyyy', { locale: fr }),
      goPrev: () => setCursor(c => subDays(c, 1)),
      goNext: () => setCursor(c => addDays(c, 1)),
    }
  }, [view, cursor])

  return (
    <div className="space-y-4">
      {/* Barre de contrôle : navigation + titre + toggle de vue */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Précédent">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="font-heading text-xl font-semibold capitalize min-w-[12rem] text-center">{title}</h2>
          <button onClick={goNext} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Suivant">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="ml-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Aujourd&apos;hui
          </button>
        </div>

        <div className="inline-flex rounded-lg border border-border overflow-hidden self-start">
          {([['month', 'Mois'], ['week', 'Semaine'], ['day', 'Jour']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'text-sm px-3 py-1.5 transition-colors',
                view === v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && <MonthView cursor={cursor} tasksForDay={tasksForDay} onSelect={setSelectedTask} showHol={showHol} showSchool={showSchool} projectionsByDay={projectionsByDay} onSelectRecurring={(m, date) => setSelectedRecurring({ model: m, date })} absencesByDay={absencesByDay} eventsByDay={eventsByDay} onSelectEvent={(ev, date) => setShowEventModal({ event: ev, date })} onAddEvent={(date) => setShowEventModal({ date })} />}
      {view === 'week'  && <WeekView  cursor={cursor} tasksForDay={tasksForDay} onSelect={setSelectedTask} />}
      {view === 'day'   && <DayView   cursor={cursor} tasksForDay={tasksForDay} onSelect={setSelectedTask} />}

      {selectedTask && (
        <TaskModal task={selectedTask} open={!!selectedTask} onClose={() => setSelectedTask(null)} />
      )}

      {/* Détail d'une occurrence récurrente (clic sur un fantôme du calendrier) */}
      {/* Création / édition d'un événement de calendrier (réunion, anniversaire…) */}
      {showEventModal && (
        <EventModal
          defaultDate={showEventModal.date}
          event={showEventModal.event}
          onClose={() => setShowEventModal(null)}
          onSaved={() => { setShowEventModal(null); loadEvents() }}
        />
      )}

      {selectedRecurring && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setSelectedRecurring(null)}>
          <div className="bg-card rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} style={{ boxShadow: '0 30px 80px rgba(20,30,40,0.2)' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">↻</span>
              <h2 className="text-lg font-extrabold tracking-tight">Carte récurrente</h2>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Titre</p>
                <p className="text-sm font-medium">{selectedRecurring.model.title}</p>
              </div>
              {selectedRecurring.model.description && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</p>
                  <p className="text-sm text-muted-foreground">{selectedRecurring.model.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Récurrence</p>
                <p className="text-sm">{describeRecurrence(selectedRecurring.model)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Apparition dans le Kanban</p>
                <p className="text-sm">{selectedRecurring.model.lead_days} jour{selectedRecurring.model.lead_days > 1 ? 's' : ''} avant l'échéance</p>
              </div>
              {selectedRecurring.model.department && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedRecurring.model.department.color }} />
                  <span className="text-sm text-muted-foreground">{selectedRecurring.model.department.name}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-4">Cette occurrence est une projection. En l'ouvrant, la carte complète est disponible (commentaires, sous-tâches…) mais elle n'apparaîtra dans le Kanban qu'à l'approche de sa date.</p>
            <div className="mt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Occurrence</p>
              <p className="text-sm font-medium">{format(parseISO(selectedRecurring.date), 'EEEE d MMMM yyyy', { locale: fr })}</p>
            </div>
            <button onClick={materializeAndOpen} disabled={materializing}
              className="mt-4 w-full py-2.5 rounded-xl text-white text-sm font-bold transition-transform hover:scale-[1.01] disabled:opacity-50"
              style={{ backgroundColor: selectedRecurring.model.department?.color ?? 'var(--accent)' }}>
              {materializing ? 'Ouverture…' : 'Ouvrir la carte complète'}
            </button>
            <button onClick={() => setSelectedRecurring(null)} className="mt-2 w-full py-2 rounded-xl bg-muted text-sm font-medium hover:bg-muted/70 transition-colors">Fermer</button>
          </div>
        </div>
      )}
    </div>
  )
}

interface SubViewProps {
  cursor: Date
  tasksForDay: (day: Date) => Task[]
  onSelect: (task: Task) => void
  showHol?: boolean
  showSchool?: boolean
  projectionsByDay?: Map<string, RecurringTask[]>
  absencesByDay?: Map<string, { name: string; type: string }[]>
  onSelectRecurring?: (m: RecurringTask, date: string) => void
  eventsByDay?: Map<string, CalendarEvent[]>
  onSelectEvent?: (ev: CalendarEvent, date?: Date) => void
  onAddEvent?: (date: Date) => void
}

function TaskChip({ task, onSelect }: { task: Task; onSelect: (t: Task) => void }) {
  return (
    <button
      onClick={() => onSelect(task)}
      className="w-full text-left text-xs px-1.5 py-0.5 rounded text-white truncate transition-opacity hover:opacity-80"
      style={{ backgroundColor: task.department?.color ?? '#94A3B8' }}
      title={task.title}
    >
      {task.title}
    </button>
  )
}

function MonthView({ cursor, tasksForDay, onSelect, showHol, showSchool, projectionsByDay, onSelectRecurring, absencesByDay, eventsByDay, onSelectEvent, onAddEvent }: SubViewProps) {
  const monthStart = startOfMonth(cursor)
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(cursor) })
  const startOffset = (getDay(monthStart) + 6) % 7

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`offset-${i}`} className="min-h-[100px] border-b border-r border-border bg-muted/20" />
        ))}
        {days.map(day => {
          const dayTasks = tasksForDay(day)
          const today = isToday(day)
          const ds = dsLocal(day)
          const ferie = (showHol ?? true) ? holidayName(ds) : null
          const vacances = (showSchool ?? true) ? schoolHolidayName(ds) : null
          const projections = projectionsByDay?.get(ds) ?? []
          const dayAbsences = absencesByDay?.get(ds) ?? []
          const dayEvents = eventsByDay?.get(ds) ?? []
          return (
            <div key={day.toISOString()} className={cn('group relative min-h-[100px] p-2 border-b border-r border-border', today && 'bg-primary/5')}
              style={!today && ferie ? { backgroundColor: 'rgba(217,70,239,0.07)' } : !today && vacances ? { backgroundColor: 'rgba(234,179,8,0.07)' } : undefined}
              title={ferie ?? vacances ?? undefined}>
              <div className="flex items-center justify-between mb-1">
                <div className={cn('text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full', today && 'bg-primary text-primary-foreground')}
                  style={!today && ferie ? { color: '#C026D3' } : undefined}>
                  {format(day, 'd')}
                </div>
                <button onClick={() => onAddEvent?.(day)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted text-muted-foreground"
                  title="Ajouter un événement ce jour">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {ferie && <p className="text-[0.6rem] leading-tight mb-0.5 truncate font-medium" style={{ color: '#C026D3' }} title={ferie}>{ferie}</p>}
              <div className="space-y-0.5">
                {/* Événements de calendrier (réunions, anniversaires…) — jamais dans le Kanban */}
                {dayEvents.map(ev => (
                  <button key={`evt-${ev.id}`} onClick={() => onSelectEvent?.(ev, day)}
                    className="w-full text-left text-[0.65rem] leading-tight px-1.5 py-0.5 rounded truncate font-medium text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: CATEGORY_COLORS[ev.category] }}
                    title={`${ev.title}${ev.event_time ? ' · ' + ev.event_time.slice(0, 5) : ''}`}>
                    {ev.event_time ? `${ev.event_time.slice(0, 5)} ` : ''}{ev.title}
                  </button>
                ))}
                {dayTasks.slice(0, 3).map(task => <TaskChip key={task.id} task={task} onSelect={onSelect} />)}
                {dayTasks.length > 3 && <p className="text-xs text-muted-foreground pl-1">+{dayTasks.length - 3}</p>}
                {/* Projections récurrentes (fantômes) : occurrences à venir, cliquables */}
                {projections.map(m => (
                  <button key={`proj-${m.id}`} onClick={() => onSelectRecurring?.(m, ds)}
                    className="w-full text-left text-[0.65rem] leading-tight px-1.5 py-0.5 rounded truncate border border-dashed transition-colors hover:bg-muted"
                    style={{ borderColor: (m.department?.color ?? '#94A3B8') + '99', color: 'var(--muted-foreground)' }}
                    title={`${m.title} (récurrent)`}>
                    ↻ {m.title}
                  </button>
                ))}
                {/* Mon congé validé ce jour (option du profil) */}
                {dayAbsences.length > 0 && (
                  <p className="flex items-center gap-1 text-[0.6rem] leading-tight px-1.5 py-0.5 rounded truncate italic"
                    style={{ backgroundColor: 'rgba(14,165,165,0.10)', color: '#0F766E' }}
                    title={dayAbsences[0].type}>
                    <Palmtree className="w-2.5 h-2.5 flex-shrink-0" />
                    {dayAbsences[0].type}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ cursor, tasksForDay, onSelect }: SubViewProps) {
  const ws = startOfWeek(cursor, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: ws, end: endOfWeek(cursor, { weekStartsOn: 1 }) })

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden grid grid-cols-7">
      {days.map(day => {
        const dayTasks = tasksForDay(day)
        const today = isToday(day)
        return (
          <div key={day.toISOString()} className={cn('min-h-[60vh] p-2 border-r border-border last:border-r-0', today && 'bg-primary/5')}>
            <div className="text-center mb-2">
              <p className="text-xs text-muted-foreground capitalize">{format(day, 'EEE', { locale: fr })}</p>
              <div className={cn('text-sm font-medium w-7 h-7 mx-auto flex items-center justify-center rounded-full', today && 'bg-primary text-primary-foreground')}>
                {format(day, 'd')}
              </div>
            </div>
            <div className="space-y-1">
              {dayTasks.length === 0
                ? <p className="text-xs text-muted-foreground/50 text-center mt-2">—</p>
                : dayTasks.map(task => <TaskChip key={task.id} task={task} onSelect={onSelect} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DayView({ cursor, tasksForDay, onSelect }: SubViewProps) {
  const dayTasks = tasksForDay(cursor)
  const today = isToday(cursor)

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className={cn('text-sm font-semibold', today && 'text-primary')}>
          {dayTasks.length} tâche{dayTasks.length > 1 ? 's' : ''} avec échéance ce jour
        </span>
      </div>
      {dayTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm">Aucune tâche pour cette journée</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dayTasks.map(task => (
            <button
              key={task.id}
              onClick={() => onSelect(task)}
              className="w-full flex items-center gap-3 p-3 bg-background border border-border rounded-lg hover:shadow-sm transition-shadow text-left"
            >
              <span className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: task.department?.color ?? '#94A3B8' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                {task.department && <p className="text-xs text-muted-foreground">{task.department.name}</p>}
              </div>
              <span className="text-xs px-2 py-0.5 rounded text-white flex-shrink-0" style={{ backgroundColor: task.department?.color ?? '#94A3B8' }}>
                {task.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}