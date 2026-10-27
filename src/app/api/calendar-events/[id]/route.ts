import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyAttendees } from '@/lib/calendar/notifyAttendees'

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
  const { data: existing } = await supabase.from('calendar_events').select('created_by, title, event_date, event_time, note').eq('id', params.id).single()
  if (!existing || existing.created_by !== userId) {
    return NextResponse.json({ error: 'Seul le créateur peut modifier cet événement' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  for (const k of ['title', 'event_date', 'event_time', 'note', 'category', 'is_recurring_yearly', 'is_shared']) {
    if (k in b) updates[k] = b[k]
  }
  const { error } = await supabase.from('calendar_events').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Invités : on remplace la liste ; seuls les NOUVEAUX invités reçoivent une invitation.
  if (Array.isArray(b.attendee_ids)) {
    const wanted = [...new Set((b.attendee_ids as unknown[]).filter((x): x is string => typeof x === 'string' && x !== userId))]
    const { data: current } = await supabase.from('calendar_event_attendees').select('user_id').eq('event_id', params.id)
    const before = new Set((current ?? []).map(r => r.user_id as string))
    await supabase.from('calendar_event_attendees').delete().eq('event_id', params.id)
    if (wanted.length > 0) {
      const { error: attErr } = await supabase.from('calendar_event_attendees')
        .insert(wanted.map(user_id => ({ event_id: params.id, user_id })))
      if (!attErr) {
        const added = wanted.filter(id => !before.has(id))
        await notifyAttendees({
          supabase, creatorId: userId, userIds: added,
          title: (updates.title as string) ?? existing.title, date: (updates.event_date as string) ?? existing.event_date,
          time: ('event_time' in updates ? (updates.event_time as string | null) : existing.event_time) ?? null,
          note: ('note' in updates ? (updates.note as string | null) : existing.note) ?? null,
        })
      }
    }
  }
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
