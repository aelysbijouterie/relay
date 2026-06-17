import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { StatsView } from '@/components/stats/StatsView'

export const dynamic = 'force-dynamic'

export default async function StatsPage() {
  const raw = cookies().get('relays-session')?.value
  if (!raw) redirect('/login')

  let userId: string
  try { userId = JSON.parse(raw).user_id } catch { redirect('/login') }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, name, role, department_id, department:departments!department_id(id, name, color)')
    .eq('id', userId!)
    .single()

  const role = (data?.role ?? 'collaborateur') as 'admin' | 'manager' | 'collaborateur'
  const canSeeTeam = role === 'manager' || role === 'admin'
  const deptName = (data?.department as { name?: string } | null)?.name ?? null
  const deptColor = (data?.department as { color?: string } | null)?.color ?? '#6366f1'

  return (
    <StatsView
      canSeeTeam={canSeeTeam}
      deptName={deptName}
      deptColor={deptColor}
    />
  )
}