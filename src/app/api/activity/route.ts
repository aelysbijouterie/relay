import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Fil d'activité visible par l'utilisateur.
// Règle : événements sur les tâches qu'il a créées ou où il est assigné ;
// si manager/admin, aussi toutes les tâches de son/ses département(s).
export async function GET() {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const supabase = createAdminClient()

  // Profil : rôle, département principal + supplémentaires, dernière consultation
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, department_id, extra_department_ids, last_seen_activity_at')
    .eq('id', userId)
    .single()

  if (!profile) return NextResponse.json({ items: [], unread: 0 })

  const isManager = profile.role === 'manager' || profile.role === 'admin'
  const myDeptIds: string[] = [profile.department_id, ...(profile.extra_department_ids ?? [])].filter(Boolean)

  // 1) Tâches "perso" : créées par moi ou avec moi assigné
  const { data: createdRows } = await supabase
    .from('tasks').select('id').eq('created_by', userId)
  const { data: assignedRows } = await supabase
    .from('task_assignees').select('task_id').eq('user_id', userId)

  const visibleTaskIds = new Set<string>()
  ;(createdRows ?? []).forEach(r => visibleTaskIds.add(r.id))
  ;(assignedRows ?? []).forEach(r => visibleTaskIds.add(r.task_id))

  // 2) Si manager/admin : ajouter toutes les tâches de ses départements
  if (isManager && myDeptIds.length) {
    const { data: deptTasks } = await supabase
      .from('tasks').select('id').in('department_id', myDeptIds)
    ;(deptTasks ?? []).forEach(r => visibleTaskIds.add(r.id))
  }

  if (visibleTaskIds.size === 0) {
    return NextResponse.json({ items: [], unread: 0, lastSeen: profile.last_seen_activity_at })
  }

  // 3) Activité sur ces tâches (200 plus récentes)
  const { data: activity } = await supabase
    .from('task_activity')
    .select(`
      id, type, field, old_value, new_value, created_at, actor_id,
      actor:profiles!actor_id(id, name, avatar_url),
      task:tasks!task_id(id, title, department:departments!department_id(name, color))
    `)
    .in('task_id', Array.from(visibleTaskIds))
    .order('created_at', { ascending: false })
    .limit(200)

  const lastSeen = profile.last_seen_activity_at
  // Non-lus : événements plus récents que la dernière visite, hors mes propres actions
  const items = (activity ?? []).map((a: Record<string, unknown>) => {
    const actor = Array.isArray(a.actor) ? a.actor[0] : a.actor
    const task = Array.isArray(a.task) ? a.task[0] : a.task
    return { ...a, actor: actor ?? null, task: task ?? null }
  }) as unknown as Array<{ actor_id: string | null; created_at: string } & Record<string, unknown>>

  const unread = items.filter(
    a => a.actor_id !== userId && new Date(a.created_at as string) > new Date(lastSeen)
  ).length

  return NextResponse.json({ items, unread, lastSeen }, { headers: { 'Cache-Control': 'no-store' } })
}

// Marque le fil comme "lu maintenant"
export async function POST() {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const supabase = createAdminClient()
  await supabase.from('profiles')
    .update({ last_seen_activity_at: new Date().toISOString() })
    .eq('id', userId)

  return NextResponse.json({ success: true })
}