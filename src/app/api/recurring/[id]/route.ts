import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// PATCH : modifier un modèle (ou l'activer/désactiver).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const b = await request.json()
  const supabase = createAdminClient()
  const updates: Record<string, unknown> = {}
  for (const k of ['title', 'description', 'priority', 'department_id', 'frequency', 'weekday', 'month_day', 'assignee_ids', 'is_active']) {
    if (k in b) updates[k] = b[k]
  }
  const { error } = await supabase.from('recurring_tasks').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE : supprimer un modèle.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('recurring_tasks').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
