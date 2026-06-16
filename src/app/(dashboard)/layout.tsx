export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { TasksProvider } from '@/components/providers/TasksProvider'
import { DEMO_DEPARTMENTS, DEMO_PROFILES, getTasksForDept } from '@/lib/demo-data'
import type { Profile, Department, Task } from '@/types'

function createAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (url: RequestInfo | URL, options?: RequestInit) =>
          fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  )
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const demoDeptId  = cookieStore.get('relays-demo')?.value

  let profile: Profile
  let department: Department
  let departments: Department[]
  let members: Profile[]
  let extraDepartments: Department[] = []
  let tasks: Task[] = []

  if (demoDeptId) {
    const slug  = DEMO_DEPARTMENTS.find(d => d.id === demoDeptId)?.slug ?? 'marketing'
    const demo  = DEMO_PROFILES[slug] ?? DEMO_PROFILES['marketing']
    profile     = demo.profile
    department  = demo.department
    departments = DEMO_DEPARTMENTS
    members     = demo.members
    tasks       = getTasksForDept(demoDeptId)
  } else {
    const raw = cookieStore.get('relays-session')?.value
    if (!raw) redirect('/login')

    let userId: string
    let userEmail: string
    try {
      const s   = JSON.parse(raw)
      userId    = s.user_id
      userEmail = s.email ?? ''
    } catch {
      redirect('/login')
    }

    const supabase = createAdmin()

    const [profileResult, deptResult, tasksResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, email, role, department_id, avatar_url, is_active, extra_department_ids')
        .eq('id', userId!)
        .single(),
      supabase
        .from('departments')
        .select('id, name, slug, color, icon'),
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
        .order('deadline', { ascending: true, nullsFirst: false })
        .limit(500),
    ])

    departments = deptResult.data && deptResult.data.length > 0
      ? deptResult.data
      : DEMO_DEPARTMENTS

    if (!tasksResult.error && tasksResult.data && tasksResult.data.length > 0) {
      tasks = tasksResult.data.map((t: Record<string, unknown>) => ({
        ...t,
        assignees:         ((t.assignees as { user: unknown }[]) ?? []).map(a => a.user),
        extra_departments: ((t.extra_departments as { department: unknown }[]) ?? []).map(a => a.department),
      })) as unknown as Task[]
    }

    const profileRow    = profileResult.data
    const activeDept    = cookieStore.get('relays-active-dept')?.value
    const primaryDeptId = profileRow?.department_id ?? departments[0]?.id
    const extraDeptIds: string[] = profileRow?.extra_department_ids ?? []
    const deptId = activeDept && [primaryDeptId, ...extraDeptIds].includes(activeDept)
      ? activeDept : primaryDeptId

    department       = departments.find(d => d.id === deptId) ?? departments[0]
    extraDepartments = departments.filter(d => extraDeptIds.includes(d.id) && d.id !== deptId)

    profile = {
      id:            profileRow?.id ?? userId!,
      name:          profileRow?.name ?? userEmail!.split('@')[0],
      email:         profileRow?.email ?? userEmail!,
      role:          (profileRow?.role ?? 'collaborateur') as Profile['role'],
      department_id: deptId,
      avatar_url:    profileRow?.avatar_url ?? null,
      is_active:     profileRow?.is_active ?? true,
      created_at:    '',
      department,
    }

    const { data: memberRows } = await supabase
      .from('profiles')
      .select('id, name, email, role, department_id, avatar_url')
      .eq('department_id', department.id)
      .eq('is_active', true)

    members = (memberRows ?? []).map(m => ({
      id:            m.id,
      name:          m.name,
      email:         m.email ?? '',
      role:          m.role as Profile['role'],
      department_id: m.department_id,
      avatar_url:    m.avatar_url ?? null,
      is_active:     true,
      created_at:    '',
      department,
    }))
  }

  return (
    <TasksProvider initialTasks={tasks} userId={profile!.id} deptId={department!.id}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar profile={profile!} members={members!} department={department!} extraDepartments={extraDepartments} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header department={department!} profile={profile!} departments={departments!} members={members!} isDemo={!!demoDeptId} />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </TasksProvider>
  )
}
