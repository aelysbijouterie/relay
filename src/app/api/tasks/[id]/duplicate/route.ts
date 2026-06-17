import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/tasks/activity'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Duplique une carte : champs principaux + sous-tâches (pas les fichiers).
// La copie appartient à l'utilisateur qui duplique, repart en statut "A Faire".
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: src, error: srcErr } = await supabase
    .from('tasks')
    .select('title, description, priority, department_id, deadline, is_cross_team, fournisseur_client, ref_collection')
    .eq('id', params.id)
    .single()

  if (srcErr || !src) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  const { data: copy, error: insErr } = await supabase
    .from('tasks')
    .insert({
      title:        `${src.title} (copie)`,
      description:  src.description,
      priority:     src.priority,
      department_id: src.department_id,
      deadline:     src.deadline,
      is_cross_team: src.is_cross_team,
      fournisseur_client: src.fournisseur_client,
      ref_collection: src.ref_collection,
      status:       'A Faire',
      created_by:   userId,
    })
    .select('id')
    .single()

  if (insErr || !copy) return NextResponse.json({ error: insErr?.message ?? 'Erreur' }, { status: 500 })

  // Copier les sous-tâches (remises à non cochées)
  const { data: subs } = await supabase
    .from('task_subtasks')
    .select('title, group_name, position')
    .eq('task_id', params.id)

  if (subs?.length) {
    await supabase.from('task_subtasks').insert(
      subs.map(s => ({ task_id: copy.id, title: s.title, group_name: s.group_name ?? 'Général', position: s.position ?? 0, created_by: userId, is_done: false }))
    )
  }

  // Copier les tags
  const { data: tags } = await supabase.from('task_tags').select('tag_id').eq('task_id', params.id)
  if (tags?.length) {
    await supabase.from('task_tags').insert(tags.map(t => ({ task_id: copy.id, tag_id: t.tag_id })))
  }

  await logActivity({ taskId: copy.id, actorId: userId, type: 'created', newValue: 'Dupliquée' })

  return NextResponse.json({ success: true, taskId: copy.id })
}