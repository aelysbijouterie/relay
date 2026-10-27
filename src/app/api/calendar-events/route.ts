import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserDepartmentIds } from '@/lib/tasks/visibility'
import { notifyAttendees } from '@/lib/calendar/notifyAttendees'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// GET : les événements visibles par l'utilisateur — les siens (personnels)
// + ceux partagés avec l'un de ses services.
export async function GET() {
  const userId = getUserId()
  if (!userId) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })

  const supabase = createAdminClient()
  const departmentIds = await getUserDepartmentIds(supabase, userId)

  // Événements auxquels la personne est invitée nommément (table optionnelle : tolérant si absente).
  const { data: invited } = await supabase
    .from('calendar_event_attendees').select('event_id').eq('user_id', userId)
  const invitedIds = (invited ?? []).map(r => r.event_id as string)

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*, department:departments!department_id(id, name, color)')
    .or([
      `created_by.eq.${userId}`,
      `and(is_shared.eq.true,department_id.in.(${departmentIds.length ? departmentIds.join(',') : 'null'}))`,
      ...(invitedIds.length ? [`id.in.(${invitedIds.join(',')})`] : []),
    ].join(','))

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })

  // Invités de chaque événement renvoyé.
  const eventIds = (data ?? []).map(e => e.id as string)
  const attendeesByEvent = new Map<string, { id: string; name: string }[]>()
  if (eventIds.length > 0) {
    const { data: links } = await supabase
      .from('calendar_event_attendees').select('event_id, user:profiles(id, name)').in('event_id', eventIds)
    for (const l of (links ?? []) as unknown as { event_id: string; user: { id: string; name: string } | { id: string; name: string }[] | null }[]) {
      const u = Array.isArray(l.user) ? l.user[0] : l.user
      if (!u) continue
      attendeesByEvent.set(l.event_id, [...(attendeesByEvent.get(l.event_id) ?? []), u])
    }
  }

  const mapped = (data ?? []).map((e: Record<string, unknown>) => ({
    ...e,
    department: Array.isArray(e.department) ? e.department[0] ?? null : e.department ?? null,
    attendees: attendeesByEvent.get(e.id as string) ?? [],
    is_mine: e.created_by === userId,
  }))
  return NextResponse.json(mapped, { headers: { 'Cache-Control': 'no-store' } })
}

// POST : créer un événement.
export async function POST(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const b = await request.json()
  if (!b.title?.trim() || !b.event_date) {
    return NextResponse.json({ error: 'Titre et date requis' }, { status: 400 })
  }

  const supabase = createAdminClient()
  // Service actif de l'utilisateur, utilisé si l'événement est partagé.
  const { data: profile } = await supabase.from('profiles').select('department_id').eq('id', userId).single()

  const { data, error } = await supabase.from('calendar_events').insert({
    title: b.title.trim(),
    event_date: b.event_date,
    event_time: b.event_time || null,
    note: b.note?.trim() || null,
    category: ['reunion', 'anniversaire', 'autre'].includes(b.category) ? b.category : 'autre',
    is_recurring_yearly: !!b.is_recurring_yearly,
    is_shared: !!b.is_shared,
    department_id: b.is_shared ? (profile?.department_id ?? null) : null,
    created_by: userId,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Invités nommés (hors créateur) + invitation par e-mail.
  const attendeeIds: string[] = Array.isArray(b.attendee_ids)
    ? [...new Set((b.attendee_ids as unknown[]).filter((x): x is string => typeof x === 'string' && x !== userId))] : []
  if (attendeeIds.length > 0) {
    const { error: attErr } = await supabase.from('calendar_event_attendees')
      .insert(attendeeIds.map(user_id => ({ event_id: data.id, user_id })))
    if (!attErr) {
      await notifyAttendees({ supabase, creatorId: userId, userIds: attendeeIds, title: b.title.trim(), date: b.event_date, time: b.event_time || null, note: b.note?.trim() || null })
    }
  }
  return NextResponse.json({ success: true, id: data.id })
}
