export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { KanbanBoardServer } from '@/components/kanban/KanbanBoardServer'
import { DEMO_TASKS, DEMO_PROFILES, DEMO_DEPARTMENTS, getTasksForDept } from '@/lib/demo-data'
import type { Task } from '@/types'

function createAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function KanbanPage() {
  const cookieStore = cookies()
  const demoDeptId  = cookieStore.get('relays-demo')?.value

  let tasks: Task[]            = []
  let currentDepartmentId      = ''
  let currentUserName: string | undefined

  if (demoDeptId) {
    tasks               = getTasksForDept(demoDeptId)
    currentDepartmentId = demoDeptId
    const slug          = DEMO_DEPARTMENTS.find(d => d.id === demoDeptId)?.slug ?? 'marketing'
    currentUserName     = DEMO_PROFILES[slug]?.profile.name
  } else {
    // Lire le cookie de session
    const raw = cookieStore.get('relays-session')?.value
    if (!raw) redirect('/login')

    let userId: string
    try {
      userId = JSON.parse(raw).user_id
    } catch {
      redirect('/login')
    }

    const supabase = createAdmin()

    // Profil
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, name, department_id')
      .eq('id', userId!)
      .single()

    const activeDept        = cookieStore.get('relays-active-dept')?.value
    currentDepartmentId     = activeDept ?? profileRow?.department_id ?? ''
    currentUserName         = profileRow?.name ?? ''

    // Tâches
    const { data, error } = await supabase
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

    if (!error && data && data.length > 0) {
      tasks = data.map((t: Record<string, unknown>) => ({
        ...t,
        assignees:         ((t.assignees as { user: unknown }[]) ?? []).map(a => a.user),
        extra_departments: ((t.extra_departments as { department: unknown }[]) ?? []).map(a => a.department),
      })) as unknown as Task[]
    }
    // Si table vide ou erreur → tableau vide (pas de fausses données démo)
  }

  return (
    <KanbanBoardServer
      initialTasks={tasks}
      currentDepartmentId={currentDepartmentId}
      currentUserName={currentUserName}
    />
  )
}
