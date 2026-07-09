import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

const TASK_SELECT = `
  id, title, description, status, priority, deadline, position, recurring_task_id,
  is_cross_team, fournisseur_client, ref_collection,
  parent_task_id, created_at, updated_at, department_id, created_by,
  department:departments!department_id(id, name, color, slug, icon),
  assignees:task_assignees(
    user:profiles(id, name, email, avatar_url, role, department_id,
      department:departments(id, name, color, slug))
  ),
  extra_departments:task_departments(department:departments(id, name, color, slug)),
  tags:task_tags(tag:tags(id, name, color))
`

// POST { date } : crée MAINTENANT la carte d'une occurrence récurrente
// (au lieu d'attendre le cron), et renvoie la carte complète pour l'ouvrir.
// Si la carte de cette occurrence existe déjà, on renvoie l'existante.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { date } = await request.json()
  if (!date) return NextResponse.json({ error: 'Date requise' }, { status: 400 })

  const supabase = createAdminClient()

  // Déjà créée pour cette date ? on renvoie l'existante (pas de doublon).
  const { data: existing } = await supabase
    .from('tasks').select(TASK_SELECT)
    .eq('recurring_task_id', params.id).eq('deadline', date)
    .is('deleted_at', null)
    .limit(1).maybeSingle()
  if (existing) return NextResponse.json({ task: existing, created: false })

  const { data: model } = await supabase
    .from('recurring_tasks').select('*').eq('id', params.id).single()
  if (!model) return NextResponse.json({ error: 'Modèle introuvable' }, { status: 404 })

  const { data: card, error } = await supabase
    .from('tasks')
    .insert({
      title: model.title,
      description: model.description,
      priority: model.priority || 'Moyenne',
      department_id: model.department_id,
      status: 'A Faire',
      deadline: date,
      created_by: model.created_by ?? userId,
      recurring_task_id: model.id,
    })
    .select('id')
    .single()
  if (error || !card) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })

  if (Array.isArray(model.assignee_ids) && model.assignee_ids.length > 0) {
    await supabase.from('task_assignees').insert(
      model.assignee_ids.map((uid: string) => ({ task_id: card.id, user_id: uid }))
    )
  }

  const { data: full } = await supabase
    .from('tasks').select(TASK_SELECT).eq('id', card.id).single()
  return NextResponse.json({ task: full, created: true })
}
