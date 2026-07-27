import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserDepartmentIds } from '@/lib/tasks/visibility'

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

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*, department:departments!department_id(id, name, color)')
    .or(`created_by.eq.${userId},and(is_shared.eq.true,department_id.in.(${departmentIds.length ? departmentIds.join(',') : 'null'}))`)

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  const mapped = (data ?? []).map((e: Record<string, unknown>) => ({
    ...e, department: Array.isArray(e.department) ? e.department[0] ?? null : e.department ?? null,
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
  return NextResponse.json({ success: true, id: data.id })
}
