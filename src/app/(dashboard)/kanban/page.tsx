import { cookies } from 'next/headers'
import { KanbanBoardServer } from '@/components/kanban/KanbanBoardServer'
import { createServerClient } from '@/lib/supabase/server'
import { DEMO_TASKS, getTasksForDept } from '@/lib/demo-data'
import type { Task } from '@/types'

export default async function KanbanPage() {
  const cookieStore = cookies()
  const demoDeptId = cookieStore.get('relays-demo')?.value

  let tasks: Task[] = []

  if (demoDeptId) {
    tasks = getTasksForDept(demoDeptId)
  } else {
    try {
      const supabase = createServerClient()
      const { data } = await supabase
        .from('tasks')
        .select(`
          id, title, description, status, priority, deadline,
          is_cross_team, fournisseur_client, ref_collection,
          parent_task_id, created_at, updated_at, department_id, created_by,
          department:departments(id, name, color, slug),
          assignees:task_assignees(user:profiles(id, name, avatar_url, role, department_id)),
          extra_departments:task_departments(department:departments(id, name, color, slug))
        `)
        .neq('status', 'Archivé')
        .order('deadline', { ascending: true, nullsFirst: false })
        .limit(200)

      if (data && data.length > 0) {
        tasks = data.map((t: Record<string, unknown>) => ({
          ...t,
          assignees: ((t.assignees as { user: unknown }[]) ?? []).map(a => a.user),
          extra_departments: ((t.extra_departments as { department: unknown }[]) ?? []).map(a => a.department),
        })) as unknown as Task[]
      } else {
        tasks = DEMO_TASKS
      }
    } catch {
      tasks = DEMO_TASKS
    }
  }

  return <KanbanBoardServer initialTasks={tasks} currentDepartmentId={demoDeptId ?? ''} />
}
