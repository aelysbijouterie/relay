'use client'

import { useState } from 'react'
import { Plus, Filter, Moon, Sun, Search } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTaskStore } from '@/store/tasks'
import { NewTaskModal } from '@/components/tasks/NewTaskModal'
import type { Department, Profile } from '@/types'

interface HeaderProps {
  department: Department
  profile: Profile
  departments: Department[]
  members: Profile[]
}

export function Header({ department, profile, departments, members }: HeaderProps) {
  const [showNewTask, setShowNewTask] = useState(false)
  const { myTasksOnly, toggleMyTasks } = useTaskStore()
  const { theme, setTheme } = useTheme()

  return (
    <>
      <header
        className="flex items-center justify-between px-6 glass border-b border-white/10 border-x-0 border-t-0 z-10"
        style={{ height: 'var(--header-height)' }}
      >
        {/* Left */}
        <div className="flex items-center gap-3 ml-10 lg:ml-0">
          <div
            className="w-2 h-2 rounded-full glow-dot"
            style={{ color: department.color, backgroundColor: department.color }}
          />
          <h1 className="font-heading font-semibold text-lg">{department.name}</h1>
          <span className="hidden sm:inline text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted/60">
            Vue Kanban
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Mes tâches */}
          <button
            onClick={toggleMyTasks}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200',
              myTasksOnly
                ? 'text-white border-transparent shadow-md'
                : 'border-white/20 hover:bg-white/10 text-muted-foreground'
            )}
            style={myTasksOnly ? {
              background: `linear-gradient(135deg, ${department.color}ee, ${department.color}99)`,
              boxShadow: `0 4px 14px ${department.color}44`,
            } : {}}
          >
            <Filter className="w-3 h-3" />
            <span className="hidden sm:inline">Mes tâches</span>
          </button>

          {/* Dark mode */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          >
            {theme === 'dark'
              ? <Sun className="w-3.5 h-3.5" />
              : <Moon className="w-3.5 h-3.5" />
            }
          </button>

          {/* Nouvelle tâche */}
          <button
            onClick={() => setShowNewTask(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white font-medium transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${department.color}, ${department.color}bb)`,
              boxShadow: `0 4px 14px ${department.color}55`,
            }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouvelle tâche</span>
          </button>
        </div>
      </header>

      <NewTaskModal
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        currentDepartmentId={department.id}
        departments={departments}
        members={members}
      />
    </>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
