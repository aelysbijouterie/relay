import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { DEMO_DEPARTMENTS, DEMO_PROFILES } from '@/lib/demo-data'
import type { Profile, Department } from '@/types'

const FALLBACK_DEPT: Department = {
  id: 'fallback', name: 'RELAYS', slug: 'relays',
  color: '#6366F1', icon: 'R',
}
const FALLBACK_PROFILE = (email: string, id: string): Profile => ({
  id, name: email.split('@')[0], email,
  role: 'collaborateur', department_id: 'fallback',
  avatar_url: null, is_active: true, created_at: '',
  department: FALLBACK_DEPT,
})

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const demoDeptId = cookieStore.get('relays-demo')?.value

  let profile: Profile
  let department: Department
  let departments: Department[]
  let members: Profile[]
  let extraDepartments: Department[] = []

  if (demoDeptId) {
    // ── Mode démo ────────────────────────────────────────────────
    const slug = DEMO_DEPARTMENTS.find(d => d.id === demoDeptId)?.slug ?? 'marketing'
    const demo = DEMO_PROFILES[slug] ?? DEMO_PROFILES['marketing']
    profile     = demo.profile
    department  = demo.department
    departments = DEMO_DEPARTMENTS
    members     = demo.members
  } else {
    // ── Auth Supabase ─────────────────────────────────────────────
    try {
      const supabase = createServerClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) redirect('/login')
      const user = session.user

      const [profileResult, deptResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, email, role, department_id, avatar_url, is_active, extra_department_ids')
          .eq('id', user.id)
          .single(),
        supabase
          .from('departments')
          .select('id, name, slug, color, icon'),
      ])

      const profileRow  = profileResult.data
      const deptRows    = deptResult.data

      departments = deptRows && deptRows.length > 0 ? deptRows : DEMO_DEPARTMENTS

      const activeDeptCookie  = cookieStore.get('relays-active-dept')?.value
      const primaryDeptId     = profileRow?.department_id ?? departments[0]?.id ?? 'fallback'
      const extraDeptIds: string[] = profileRow?.extra_department_ids ?? []
      const allAllowedIds     = [primaryDeptId, ...extraDeptIds]
      const deptId            = activeDeptCookie && allAllowedIds.includes(activeDeptCookie)
        ? activeDeptCookie : primaryDeptId

      department = departments.find(d => d.id === deptId) ?? departments[0] ?? FALLBACK_DEPT

      extraDepartments = departments.filter(
        d => extraDeptIds.includes(d.id) && d.id !== deptId
      )

      profile = {
        id:            profileRow?.id ?? user.id,
        name:          profileRow?.name ?? (user.email?.split('@')[0] ?? 'Utilisateur'),
        email:         profileRow?.email ?? user.email ?? '',
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
    } catch (err: unknown) {
      // Relancer les redirects Next.js
      const e = err as { digest?: string }
      if (e?.digest?.startsWith('NEXT_REDIRECT')) throw err

      // Fallback si Supabase inaccessible — afficher quand même l'appli
      const supabase = createServerClient()
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      if (!session) redirect('/login')
      profile     = FALLBACK_PROFILE(session.user.email ?? 'user', session.user.id)
      department  = FALLBACK_DEPT
      departments = DEMO_DEPARTMENTS
      members     = []
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        profile={profile!}
        members={members!}
        department={department!}
        extraDepartments={extraDepartments}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          department={department!}
          profile={profile!}
          departments={departments!}
          members={members!}
          isDemo={!!demoDeptId}
        />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
