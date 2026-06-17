'use client'

import { useState, useMemo } from 'react'
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isSameDay, isToday, isSameMonth, addMonths, subMonths,
  startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskModal } from '@/components/tasks/TaskModal'
import { useTasks } from '@/hooks/useTasks'
import type { Task } from '@/types'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
type ViewMode = 'month' | 'week' | 'day'

export function CalendarView() {
  const { tasks } = useTasks()
  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState(new Date())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const tasksForDay = (day: Date) =>
    tasks.filter(t => t.deadline && isSameDay(parseISO(t.deadline), day))

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

      {view === 'month' && <MonthView cursor={cursor} tasksForDay={tasksForDay} onSelect={setSelectedTask} />}
      {view === 'week'  && <WeekView  cursor={cursor} tasksForDay={tasksForDay} onSelect={setSelectedTask} />}
      {view === 'day'   && <DayView   cursor={cursor} tasksForDay={tasksForDay} onSelect={setSelectedTask} />}

      {selectedTask && (
        <TaskModal task={selectedTask} open={!!selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  )
}

interface SubViewProps {
  cursor: Date
  tasksForDay: (day: Date) => Task[]
  onSelect: (task: Task) => void
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

function MonthView({ cursor, tasksForDay, onSelect }: SubViewProps) {
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
          return (
            <div key={day.toISOString()} className={cn('min-h-[100px] p-2 border-b border-r border-border', today && 'bg-primary/5')}>
              <div className={cn('text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full', today && 'bg-primary text-primary-foreground')}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(task => <TaskChip key={task.id} task={task} onSelect={onSelect} />)}
                {dayTasks.length > 3 && <p className="text-xs text-muted-foreground pl-1">+{dayTasks.length - 3}</p>}
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