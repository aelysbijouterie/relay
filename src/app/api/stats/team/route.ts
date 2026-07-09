import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import type { Task } from '@/types'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Vue équipe des statistiques, réservée aux managers et admins.
// Contrairement à /api/tasks (visibilité personnelle), cette route renvoie
// TOUTES les tâches du département du manager — c'est légitime pour le
// pilotage d'équipe, mais strictement contrôlé par le rôle.
export async function GET() {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, department_id, extra_department_ids')
    .eq('id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 401 })

  // Seuls managers et admins ont accès à la vue équipe.
  if (profile.role !== 'manager' && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Accès réservé aux managers' }, { status: 403 })
  }

  // Département à afficher : pour un manager multi-service, on suit le
  // service actuellement sélectionné dans la sidebar (cookie), à condition
  // qu'il fasse bien partie de ses départements autorisés (principal + extras).
  // Sinon on retombe sur son département principal.
  const allowedDeptIds: string[] = [
    profile.department_id,
    ...((profile.extra_department_ids as string[] | null) ?? []),
  ].filter(Boolean) as string[]

  const activeDept = cookies().get('relays-active-dept')?.value
  const targetDeptId = activeDept && allowedDeptIds.includes(activeDept)
    ? activeDept
    : profile.department_id

  // Un manager voit son département ; un admin sans département voit tout.
  let query = supabase
    .from('tasks')
    .select(`
      id, title, description, status, priority, deadline, completed_at,
      is_cross_team, fournisseur_client, ref_collection,
      parent_task_id, created_at, updated_at, department_id, created_by,
      department:departments!department_id(id, name, color, slug, icon),
      assignees:task_assignees(user:profiles(id, name, avatar_url, role, department_id)),
      extra_departments:task_departments(department:departments(id, name, color, slug))
    `)
    .neq('status', 'Archivé')
    .is('parent_task_id', null)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (profile.role === 'manager' && targetDeptId) {
    query = query.eq('department_id', targetDeptId)
  }

  const { data, error } = await query
  if (error) {
    console.error('Team stats error:', error.message)
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  }

  const tasks = (data ?? []).map((t: Record<string, unknown>) => ({
    ...t,
    assignees:         ((t.assignees as { user: unknown }[]) ?? []).map(a => a.user).filter(Boolean),
    extra_departments: ((t.extra_departments as { department: unknown }[]) ?? []).map(a => a.department).filter(Boolean),
  })) as unknown as Task[]

  return NextResponse.json(tasks, { headers: { 'Cache-Control': 'no-store' } })
}