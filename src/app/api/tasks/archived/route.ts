import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { isTaskVisibleTo, getUserDepartmentIds } from '@/lib/tasks/visibility'
import type { Task } from '@/types'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Liste des tâches ARCHIVÉES visibles par l'utilisateur (même règle de
// visibilité personnelle que le Kanban : créées ou assignées).
export async function GET() {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id, title, description, status, priority, deadline,
      is_cross_team, fournisseur_client, ref_collection,
      parent_task_id, created_at, updated_at, completed_at, department_id, created_by,
      department:departments!department_id(id, name, color, slug, icon),
      assignees:task_assignees(user:profiles(id, name, avatar_url, role, department_id)),
      tags:task_tags(tag:tags(id, name, color))
    `)
    .eq('status', 'Archivé')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('Archived error:', error.message)
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  }

  const tasks = (data ?? []).map((t: Record<string, unknown>) => ({
    ...t,
    assignees: ((t.assignees as { user: unknown }[]) ?? []).map(a => a.user).filter(Boolean),
    tags:      ((t.tags as { tag: unknown }[]) ?? []).map(a => a.tag).filter(Boolean),
  })) as unknown as Task[]

  // Visibilité d'équipe (voir route.ts principal pour le contexte)
  const departmentIds = await getUserDepartmentIds(supabase, userId)
  const visible = tasks.filter(t => isTaskVisibleTo(t, { userId, departmentIds }))
  return NextResponse.json(visible, { headers: { 'Cache-Control': 'no-store' } })
}