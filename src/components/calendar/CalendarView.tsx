'use client'

import { useState } from 'react'
import {
  format, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay, isToday, addMonths, subMonths
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskModal } from '@/components/tasks/TaskModal'
import type { Task } from '@/types'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

interface CalendarViewProps {
  tasks: Task[]
}

export function CalendarView({ tasks }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // ISO week starts Monday; getDay() returns 0=Sun
  const startOffset = (getDay(monthStart) + 6) % 7

  const tasksForDay = (day: Date) =>
    tasks.filter(t => t.deadline && isSameDay(parseISO(t.deadline), day))

  return (
    <div className="space-y-4">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="font-heading text-xl font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </h2>
        <button
          onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Day names */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {/* Offset */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`offset-${i}`} className="min-h-[100px] border-b border-r border-border bg-muted/20" />
          ))}

          {days.map(day => {
            const dayTasks = tasksForDay(day)
            const today = isToday(day)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[100px] p-2 border-b border-r border-border',
                  today && 'bg-primary/5'
                )}
              >
                <div className={cn(
                  'text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                  today && 'bg-primary text-primary-foreground'
                )}>
                  {format(day, 'd')}
                </div>

                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map(task => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="w-full text-left text-xs px-1.5 py-0.5 rounded text-white truncate transition-opacity hover:opacity-80"
                      style={{ backgroundColor: task.department?.color ?? '#94A3B8' }}
                    >
                      {task.title}
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-1">+{dayTasks.length - 3}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}
