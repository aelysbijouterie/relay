import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { KanbanBoardServer } from '@/components/kanban/KanbanBoardServer'
import { DEMO_DEPARTMENTS, DEMO_PROFILES } from '@/lib/demo-data'

function createAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export default async function KanbanPage() {
  const cookieStore = cookies()
  const demoDeptId  = cookieStore.get('relays-demo')?.value

  if (demoDeptId) {
    const slug = DEMO_DEPARTMENTS.find(d => d.id === demoDeptId)?.slug ?? 'marketing'
    return (
      <KanbanBoardServer
        currentDepartmentId={demoDeptId}
        currentUserName={DEMO_PROFILES[slug]?.profile.name}
      />
    )
  }

  const raw = cookieStore.get('relays-session')?.value
  if (!raw) redirect('/login')

  let userId: string
  try { userId = JSON.parse(raw).user_id } catch { redirect('/login') }

  const supabase    = createAdmin()
  const { data }    = await supabase
    .from('profiles').select('name, department_id').eq('id', userId!).single()

  const activeDept        = cookieStore.get('relays-active-dept')?.value
  const currentDeptId     = activeDept ?? data?.department_id ?? ''

  return (
    <KanbanBoardServer
      currentDepartmentId={currentDeptId}
      currentUserName={data?.name ?? ''}
    />
  )
}
