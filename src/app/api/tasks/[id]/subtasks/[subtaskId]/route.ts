import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string; subtaskId: string } }) {
  const body = await request.json()
  const supabase = createAdminClient()

  // Mise à jour des assignés de la sous-tâche (liste d'IDs)
  if (Array.isArray(body.assignees)) {
    await supabase.from('subtask_assignees').delete().eq('subtask_id', params.subtaskId)
    if (body.assignees.length > 0) {
      await supabase.from('subtask_assignees').insert(
        body.assignees.map((user_id: string) => ({ subtask_id: params.subtaskId, user_id }))
      )
    }
    const { data: profs } = await supabase
      .from('profiles').select('id, name, avatar_url').in('id', body.assignees.length ? body.assignees : ['00000000-0000-0000-0000-000000000000'])
    return NextResponse.json({ assignees: profs ?? [] })
  }

  // Sinon : bascule de l'état "fait"
  const { data, error } = await supabase
    .from('task_subtasks')
    .update({ is_done: body.is_done })
    .eq('id', params.subtaskId)
    .eq('task_id', params.id)
    .select('id, title, is_done, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; subtaskId: string } }) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('task_subtasks')
    .delete()
    .eq('id', params.subtaskId)
    .eq('task_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}