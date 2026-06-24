import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import type { Task } from '@/types'

function createAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        // Désactiver le cache Next.js sur les requêtes Supabase
        fetch: (url: RequestInfo | URL, options?: RequestInit) =>
          fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  )
}

export async function fetchTasksForCurrentUser(): Promise<{
  tasks: Task[]
  currentDepartmentId: string
  currentUserName: string
  isDemo: boolean
}> {
  const cookieStore = cookies()
  const demoDeptId  = (cookieStore as ReturnType<typeof cookies>).get('relays-demo')?.value

  if (demoDeptId) {
    const { DEMO_PROFILES, DEMO_DEPARTMENTS, getTasksForDept } = await import('@/lib/demo-data')
    const slug = DEMO_DEPARTMENTS.find((d: { id: string }) => d.id === demoDeptId)?.slug ?? 'marketing'
    return {
      tasks:               getTasksForDept(demoDeptId),
      currentDepartmentId: demoDeptId,
      currentUserName:     DEMO_PROFILES[slug]?.profile.name ?? '',
      isDemo:              true,
    }
  }

  const raw = (cookieStore as ReturnType<typeof cookies>).get('relays-session')?.value
  if (!raw) return { tasks: [], currentDepartmentId: '', currentUserName: '', isDemo: false }

  let userId: string
  try {
    userId = JSON.parse(raw).user_id
    if (!userId) throw new Error()
  } catch {
    return { tasks: [], currentDepartmentId: '', currentUserName: '', isDemo: false }
  }

  const supabase = createAdmin()

  const [profileResult, tasksResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, department_id')
      .eq('id', userId)
      .single(),
    supabase
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
      .is('deleted_at', null)
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(500),
  ])

  const profileRow        = profileResult.data
  const activeDept        = (cookieStore as ReturnType<typeof cookies>).get('relays-active-dept')?.value
  const currentDepartmentId = activeDept ?? profileRow?.department_id ?? ''
  const currentUserName     = profileRow?.name ?? ''

  let tasks: Task[] = []
  const { data, error } = tasksResult
  if (!error && data && data.length > 0) {
    tasks = data.map((t: Record<string, unknown>) => ({
      ...t,
      assignees:         ((t.assignees as { user: unknown }[]) ?? []).map(a => a.user),
      extra_departments: ((t.extra_departments as { department: unknown }[]) ?? []).map(a => a.department),
    })) as unknown as Task[]
  }

  return { tasks, currentDepartmentId, currentUserName, isDemo: false }
}
