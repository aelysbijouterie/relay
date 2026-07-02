import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string; subtaskId: string } }) {
  const body = await request.json()
  const supabase = createAdminClient()

  // ── 1. Mise à jour des assignés de la sous-tâche (liste d'IDs) ──────────────
  if (Array.isArray(body.assignees)) {
    await supabase.from('subtask_assignees').delete().eq('subtask_id', params.subtaskId)
    if (body.assignees.length > 0) {
      await supabase.from('subtask_assignees').insert(
        body.assignees.map((user_id: string) => ({ subtask_id: params.subtaskId, user_id }))
      )
      // Ajout AUTO à la carte parente : toute personne assignée à une sous-tâche
      // devient assignée de la carte (sans jamais retirer personne).
      const { data: existing } = await supabase
        .from('task_assignees').select('user_id').eq('task_id', params.id)
      const already = new Set((existing ?? []).map(e => e.user_id))
      const toAdd = (body.assignees as string[]).filter(uid => !already.has(uid))
      if (toAdd.length > 0) {
        await supabase.from('task_assignees').insert(
          toAdd.map(user_id => ({ task_id: params.id, user_id }))
        )
      }
    }
    const { data: profs } = await supabase
      .from('profiles').select('id, name, avatar_url')
      .in('id', body.assignees.length ? body.assignees : ['00000000-0000-0000-0000-000000000000'])
    return NextResponse.json({ assignees: profs ?? [] })
  }

  // ── Renommer la sous-tâche ──────────────────────────────────────────────────
  if (typeof body.title === 'string') {
    const { data, error } = await supabase
      .from('task_subtasks')
      .update({ title: body.title.trim() })
      .eq('id', params.subtaskId).eq('task_id', params.id)
      .select('id, title, is_done, deadline, position, created_at').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // ── 2. Mise à jour de l'échéance de la sous-tâche ───────────────────────────
  if ('deadline' in body) {
    const { data, error } = await supabase
      .from('task_subtasks')
      .update({ deadline: body.deadline || null })
      .eq('id', params.subtaskId).eq('task_id', params.id)
      .select('id, title, is_done, deadline, position, created_at').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // ── 3. Réordonnancement (nouvelle position) ─────────────────────────────────
  if ('position' in body) {
    const { error } = await supabase
      .from('task_subtasks')
      .update({ position: body.position })
      .eq('id', params.subtaskId).eq('task_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── 4. Sinon : bascule de l'état « fait » ───────────────────────────────────
  const { data, error } = await supabase
    .from('task_subtasks')
    .update({ is_done: body.is_done })
    .eq('id', params.subtaskId).eq('task_id', params.id)
    .select('id, title, is_done, deadline, created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; subtaskId: string } }) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('task_subtasks').delete()
    .eq('id', params.subtaskId).eq('task_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
