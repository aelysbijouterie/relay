import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { isTaskVisibleTo, getUserDepartmentIds } from '@/lib/tasks/visibility'
import type { Task } from '@/types'

// CRITIQUE : sans cet export, Next.js considère cette route comme statique
// (aucune Dynamic API utilisée — pas de cookies(), headers() ou searchParams)
// et la met en cache au build / au premier appel. Résultat : ce handler ne
// se réexécute plus jamais, donc /api/tasks renvoie indéfiniment le même
// instantané, qu'on crée des tâches ou non.
export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// IMPORTANT : le middleware laisse passer /api/ sans vérification d'auth,
// donc cette vérification de session est la seule barrière avant la base.
// Le client admin (service role) bypass RLS : sans elle, n'importe qui
// pourrait lire toutes les tâches de l'entreprise sans être connecté.
export async function GET() {
  const userId = getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id, title, description, status, priority, deadline, position, recurring_task_id, completed_at,
      is_cross_team, fournisseur_client, ref_collection,
      parent_task_id, created_at, updated_at, department_id, created_by,
      department:departments!department_id(id, name, color, slug, icon),
      assignees:task_assignees(
        user:profiles(id, name, email, avatar_url, role, department_id,
          department:departments(id, name, color, slug))
      ),
      extra_departments:task_departments(department:departments(id, name, color, slug)),
      tags:task_tags(tag:tags(id, name, color)),
      recurring:recurring_tasks!recurring_task_id(lead_days)
    `)
    .neq('status', 'Archivé')
    .is('deleted_at', null)
    .is('parent_task_id', null)
    .order('position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('Tasks error:', error.message)
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  }

  const tasks = (data ?? []).map((t: Record<string, unknown>) => ({
    ...t,
    assignees:         ((t.assignees as { user: unknown }[]) ?? []).map(a => a.user).filter(Boolean),
    extra_departments: ((t.extra_departments as { department: unknown }[]) ?? []).map(a => a.department).filter(Boolean),
    tags:              ((t.tags as { tag: unknown }[]) ?? []).map(a => a.tag).filter(Boolean),
    recurring:         Array.isArray(t.recurring) ? t.recurring[0] ?? null : t.recurring ?? null,
  })) as unknown as Task[]

  // Visibilité : services de l'utilisateur (principal + additionnels) + ce
  // qui le concerne personnellement (créateur ou assigné), même hors de ses
  // services — cas d'une délégation vers un autre service.
  const departmentIds = await getUserDepartmentIds(supabase, userId)
  const visibleTasks = tasks.filter(t => isTaskVisibleTo(t, { userId, departmentIds }))

  // Progression des sous-tâches (table task_subtasks) pour les barres de
  // Kanban, + échéance de chacune (pour afficher la prochaine échéance de
  // sous-tâche quand la carte elle-même n'en a pas).
  const ids = visibleTasks.map(t => t.id)
  if (ids.length > 0) {
    const { data: subs } = await supabase
      .from('task_subtasks')
      .select('task_id, is_done, deadline')
      .in('task_id', ids)
    if (subs && subs.length > 0) {
      const byTask = new Map<string, { status: string; deadline: string | null }[]>()
      for (const s of subs as { task_id: string; is_done: boolean; deadline: string | null }[]) {
        const arr = byTask.get(s.task_id) ?? []
        arr.push({ status: s.is_done ? 'Terminé' : 'A Faire', deadline: s.deadline })
        byTask.set(s.task_id, arr)
      }
      for (const t of visibleTasks) {
        const list = byTask.get(t.id)
        if (list && list.length > 0) (t as unknown as { subtasks: unknown }).subtasks = list
      }
    }
  }

  return NextResponse.json(visibleTasks, { headers: { 'Cache-Control': 'no-store' } })
}