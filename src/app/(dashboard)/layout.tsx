export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { AccentProvider } from '@/components/layout/AccentProvider'
import { TasksProvider } from '@/components/providers/TasksProvider'
import { DEMO_DEPARTMENTS, DEMO_PROFILES, getTasksForDept } from '@/lib/demo-data'
import type { Profile, Department, Task } from '@/types'

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

    const supabase = createAdminClient()

    // Profil principal. extra_department_ids est volontairement exclu d'ici :
    // c'est une colonne optionnelle (accès multi-département, à venir pour
    // Audrey) qui n'existe pas forcément encore en base, et qui ne doit
    // jamais faire échouer la lecture du profil principal.
    const profileResult = await supabase
      .from('profiles')
      .select('id, name, email, role, department_id, avatar_url, is_active')
      .eq('id', userId!)
      .single()

    // Lecture isolée et tolérante de la colonne optionnelle.
    const { data: extraRow } = await supabase
      .from('profiles')
      .select('extra_department_ids')
      .eq('id', userId!)
      .single()

    const extraDeptIds: string[] = extraRow?.extra_department_ids ?? []

    const [deptResult, tasksResult] = await Promise.all([
      supabase
        .from('departments')
        .select('id, name, slug, color, icon'),
      supabase
        .from('tasks')
        .select(`
          id, title, description, status, priority, deadline,
          is_cross_team, fournisseur_client, ref_collection,
          parent_task_id, created_at, updated_at, department_id, created_by,
          department:departments!department_id(id, name, color, slug),
          assignees:task_assignees(user:profiles(id, name, avatar_url, role, department_id)),
          extra_departments:task_departments(department:departments(id, name, color, slug)),
          tags:task_tags(tag:tags(id, name, color))
        `)
        .neq('status', 'Archivé')
        .is('deleted_at', null)
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
        tags:              ((t.tags as { tag: unknown }[]) ?? []).map(a => a.tag).filter(Boolean),
      })) as unknown as Task[]

      // Progression des sous-tâches : on lit la table task_subtasks (vraies
      // sous-tâches cochables) pour toutes les tâches affichées, puis on attache
      // un résumé {subtasks} à chaque tâche pour les barres de progression.
      const taskIds = tasks.map(t => t.id)
      if (taskIds.length > 0) {
        const { data: subs } = await supabase
          .from('task_subtasks')
          .select('task_id, is_done')
          .in('task_id', taskIds)
        if (subs && subs.length > 0) {
          const byTask = new Map<string, { status: string }[]>()
          for (const s of subs as { task_id: string; is_done: boolean }[]) {
            const arr = byTask.get(s.task_id) ?? []
            arr.push({ status: s.is_done ? 'Terminé' : 'A Faire' })
            byTask.set(s.task_id, arr)
          }
          tasks = tasks.map(t => {
            const list = byTask.get(t.id)
            return list && list.length > 0 ? ({ ...t, subtasks: list } as unknown as Task) : t
          })
        }
      }
    }

    const profileRow    = profileResult.data
    const activeDept    = cookieStore.get('relays-active-dept')?.value
    const primaryDeptId = profileRow?.department_id ?? departments[0]?.id
    const deptId = activeDept && [primaryDeptId, ...extraDeptIds].includes(activeDept)
      ? activeDept : primaryDeptId

    department = departments.find(d => d.id === deptId) ?? departments[0]

    // Tous les services de l'utilisateur = principal + supplémentaires.
    // Les "autres services" cliquables dans la sidebar = tous sauf l'actif.
    // (Avant, on n'incluait que les extras, donc le département principal
    //  disparaissait dès qu'on le quittait et n'était plus cliquable.)
    const allDeptIds = [primaryDeptId, ...extraDeptIds].filter(Boolean) as string[]
    extraDepartments = departments.filter(d => allDeptIds.includes(d.id) && d.id !== deptId)

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

    // Visibilité d'équipe : le tableau de bord (Kanban) est un espace
    // PARTAGÉ — chacun voit les tâches de son/ses service(s) (principal +
    // additionnels), plus ce qui le concerne personnellement (créateur ou
    // assigné) même hors de ses services — cas d'une délégation croisée.
    // Seul le calendrier personnel filtre séparément côté client (plus strict).
    const myDeptIds = [profileRow?.department_id, ...extraDeptIds].filter(Boolean) as string[]
    tasks = tasks.filter(t =>
      (t.department_id && myDeptIds.includes(t.department_id))
      || t.created_by === userId
      || (t.assignees ?? []).some((a: { id: string }) => a.id === userId)
    )

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
      <AccentProvider color={department!.color}>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar profile={profile!} members={members!} department={department!} extraDepartments={extraDepartments} />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Header department={department!} profile={profile!} departments={departments!} members={members!} isDemo={!!demoDeptId} />
            <main className="flex-1 overflow-auto p-6">{children}</main>
          </div>
        </div>
      </AccentProvider>
    </TasksProvider>
  )
}