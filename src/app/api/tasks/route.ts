import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { isTaskVisibleTo } from '@/lib/tasks/visibility'
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
      id, title, description, status, priority, deadline,
      is_cross_team, fournisseur_client, ref_collection,
      parent_task_id, created_at, updated_at, department_id, created_by,
      department:departments!department_id(id, name, color, slug, icon),
      assignees:task_assignees(
        user:profiles(id, name, email, avatar_url, role, department_id,
          department:departments(id, name, color, slug))
      ),
      extra_departments:task_departments(department:departments(id, name, color, slug))
    `)
    .neq('status', 'Archivé')
    .is('parent_task_id', null)
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
  })) as unknown as Task[]

  // Visibilité personnelle : chacun ne voit que ses tâches créées + assignées.
  const visibleTasks = tasks.filter(t => isTaskVisibleTo(t, { userId }))

  return NextResponse.json(visibleTasks, { headers: { 'Cache-Control': 'no-store' } })
}