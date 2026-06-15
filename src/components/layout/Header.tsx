'use client'

import { useState } from 'react'
import { Plus, Filter, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTasks } from '@/hooks/useTasks'
import { NewTaskModal } from '@/components/tasks/NewTaskModal'
import type { Department, Profile } from '@/types'

interface HeaderProps {
  department:  Department
  profile:     Profile
  departments: Department[]
  members:     Profile[]
  isDemo?:     boolean
}

export function Header({ department, profile, departments, isDemo }: HeaderProps) {
  const [showNewTask, setShowNewTask] = useState(false)
  const { theme, setTheme } = useTheme()
  const { refresh } = useTasks()

  return (
    <>
      <header
        className="flex items-center justify-between px-6 glass border-b border-white/10 border-x-0 border-t-0 z-10"
        style={{ height: 'var(--header-height)' }}
      >
        <div className="flex items-center gap-3 ml-10 lg:ml-0">
          <div className="w-2 h-2 rounded-full glow-dot"
            style={{ color: department.color, backgroundColor: department.color }} />
          <h1 className="font-heading font-semibold text-lg">{department.name}</h1>
          <span className="hidden sm:inline text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted/60">
            Vue Kanban
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {!isDemo && (
            <button
              onClick={() => setShowNewTask(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background:  `linear-gradient(135deg, ${department.color}, ${department.color}bb)`,
                boxShadow:   `0 4px 14px ${department.color}55`,
              }}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouvelle tâche</span>
            </button>
          )}
        </div>
      </header>

      {!isDemo && (
        <NewTaskModal
          open={showNewTask}
          onClose={() => setShowNewTask(false)}
          onCreated={refresh}
          currentDepartmentId={department.id}
          departments={departments}
          profile={profile}
        />
      )}
    </>
  )
}
