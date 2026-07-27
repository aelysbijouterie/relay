import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// PATCH : modifier un événement — réservé à son créateur.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const b = await request.json()

  const supabase = createAdminClient()
  const { data: existing } = await supabase.from('calendar_events').select('created_by').eq('id', params.id).single()
  if (!existing || existing.created_by !== userId) {
    return NextResponse.json({ error: 'Seul le créateur peut modifier cet événement' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  for (const k of ['title', 'event_date', 'event_time', 'note', 'category', 'is_recurring_yearly', 'is_shared']) {
    if (k in b) updates[k] = b[k]
  }
  const { error } = await supabase.from('calendar_events').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE : supprimer — réservé à son créateur.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: existing } = await supabase.from('calendar_events').select('created_by').eq('id', params.id).single()
  if (!existing || existing.created_by !== userId) {
    return NextResponse.json({ error: 'Seul le créateur peut supprimer cet événement' }, { status: 403 })
  }

  const { error } = await supabase.from('calendar_events').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
