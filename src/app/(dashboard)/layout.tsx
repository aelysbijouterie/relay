import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { DEMO_DEPARTMENTS, DEMO_PROFILES, MEMBERS_BY_DEPT, TASKS_BY_DEPT } from '@/lib/demo-data'
import type { Profile, Department } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const demoDeptId = cookieStore.get('relays-demo')?.value // ex: 'dept-marketing' ou undefined

  let profile: Profile
  let department: Department
  let departments: Department[]
  let members: Profile[]

  if (demoDeptId) {
    // ── Mode démo ────────────────────────────────────────────────
    const slug = DEMO_DEPARTMENTS.find(d => d.id === demoDeptId)?.slug ?? 'marketing'
    const demo = DEMO_PROFILES[slug] ?? DEMO_PROFILES['marketing']
    profile    = demo.profile
    department = demo.department
    departments = DEMO_DEPARTMENTS
    members    = demo.members
  } else {
    // ── Auth Supabase ─────────────────────────────────────────────
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, name, email, role, department_id, avatar_url, is_active')
      .eq('id', user.id)
      .single()

    const { data: deptRows } = await supabase
      .from('departments')
      .select('id, name, slug, color, icon')

    departments = deptRows && deptRows.length > 0 ? deptRows : DEMO_DEPARTMENTS

    const deptId   = profileRow?.department_id ?? departments[0].id
    department     = departments.find(d => d.id === deptId) ?? departments[0]

    profile = {
      id:            profileRow?.id ?? user.id,
      name:          profileRow?.name ?? (user.email?.split('@')[0] ?? 'Utilisateur'),
      email:         profileRow?.email ?? user.email ?? '',
      role:          (profileRow?.role ?? 'member') as Profile['role'],
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
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} members={members} department={department} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          department={department}
          profile={profile}
          departments={departments}
          members={members}
          isDemo={!!demoDeptId}
        />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
