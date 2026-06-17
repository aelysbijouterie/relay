import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { logActivity, canMutateTask } from '@/lib/tasks/activity'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Champs simples modifiables et tracés dans l'historique.
const EDITABLE_FIELDS = ['title', 'description', 'priority', 'deadline', 'status', 'fournisseur_client', 'ref_collection'] as const
type EditableField = typeof EDITABLE_FIELDS[number]

// PATCH : modifier une carte (un ou plusieurs champs), avec historique.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  if (!(await canMutateTask(params.id, userId))) {
    return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
  }

  const body = await request.json()
  const supabase = createAdminClient()

  // État actuel pour comparer (et tracer ancien → nouveau)
  const { data: before } = await supabase
    .from('tasks')
    .select('title, description, priority, deadline, status, fournisseur_client, ref_collection')
    .eq('id', params.id)
    .single()

  if (!before) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body && body[field] !== (before as Record<string, unknown>)[field]) {
      updates[field] = body[field]
    }
  }

  // Assignés : remplacement complet si fourni
  const assignees: string[] | undefined = Array.isArray(body.assignees) ? body.assignees : undefined

  if (Object.keys(updates).length === 0 && assignees === undefined) {
    return NextResponse.json({ error: 'Aucune modification' }, { status: 400 })
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString()
    const { error } = await supabase.from('tasks').update(updates).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Historique : une ligne par champ modifié
    for (const field of Object.keys(updates)) {
      if (field === 'updated_at') continue
      const f = field as EditableField
      await logActivity({
        taskId: params.id, actorId: userId,
        type: f === 'status' ? 'status' : 'field',
        field: f,
        oldValue: String((before as Record<string, unknown>)[f] ?? ''),
        newValue: String(updates[f] ?? ''),
      })
    }
  }

  if (assignees !== undefined) {
    await supabase.from('task_assignees').delete().eq('task_id', params.id)
    if (assignees.length) {
      await supabase.from('task_assignees').insert(assignees.map(uid => ({ task_id: params.id, user_id: uid })))
    }
    await logActivity({ taskId: params.id, actorId: userId, type: 'assignees',
      newValue: `${assignees.length} assigné(s)` })
  }

  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}

// DELETE : suppression définitive, avec contrôle de droits.
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  if (!(await canMutateTask(params.id, userId))) {
    return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('tasks').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}