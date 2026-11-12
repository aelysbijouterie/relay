import { NextRequest, NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { sanitizeAssignees } from '@/lib/boutique/session'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  return readSessionUserId()
}

// Actions groupées sur plusieurs cartes.
// body: { ids: string[], action: 'move'|'archive'|'delete'|'assign'|'priority', value?: string }
export async function POST(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { ids, action, value } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'Aucune carte' }, { status: 400 })

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  switch (action) {
    case 'move': {
      const completedAt = value === 'Terminé' ? now : null
      const { error } = await supabase.from('tasks')
        .update({ status: value, updated_at: now, completed_at: completedAt }).in('id', ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      break
    }
    case 'archive': {
      const { error } = await supabase.from('tasks')
        .update({ status: 'Archivé', updated_at: now }).in('id', ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      break
    }
    case 'delete': {
      const { error } = await supabase.from('tasks')
        .update({ deleted_at: now, deleted_by: userId }).in('id', ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      break
    }
    case 'priority': {
      const { error } = await supabase.from('tasks')
        .update({ priority: value, updated_at: now }).in('id', ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      break
    }
    case 'assign': {
      // Remplace les assignés : on retire puis on ajoute la personne choisie sur chaque carte.
      if (!value) return NextResponse.json({ error: 'Personne requise' }, { status: 400 })
      if ((await sanitizeAssignees(supabase, userId, [value])).length === 0) return NextResponse.json({ error: 'Cette personne ne peut pas être assignée' }, { status: 403 })
      for (const taskId of ids) {
        const { data: existing } = await supabase.from('task_assignees').select('user_id').eq('task_id', taskId)
        const already = new Set((existing ?? []).map(e => e.user_id))
        if (!already.has(value)) {
          await supabase.from('task_assignees').insert({ task_id: taskId, user_id: value })
        }
      }
      break
    }
    default:
      return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  }

  return NextResponse.json({ success: true, count: ids.length })
}
