import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// GET : toutes les périodes d'activité (visibles par tous, pour l'affichage rouge).
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('activity_periods')
    .select('id, department_id, label, start_date, end_date, created_by, created_at, department:departments!department_id(name, color)')
    .order('start_date', { ascending: true })
  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  const mapped = (data ?? []).map((p: Record<string, unknown>) => ({
    ...p, department: Array.isArray(p.department) ? p.department[0] : p.department,
  }))
  return NextResponse.json(mapped, { headers: { 'Cache-Control': 'no-store' } })
}

// POST : créer une période d'activité pour SON service (managers/admins).
export async function POST(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { label, start_date, end_date } = await request.json()
  if (!start_date || !end_date) return NextResponse.json({ error: 'Dates requises' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: me } = await supabase.from('profiles').select('role, department_id').eq('id', userId).single()
  if (!me || (me.role !== 'manager' && me.role !== 'admin')) {
    return NextResponse.json({ error: 'Réservé aux responsables' }, { status: 403 })
  }
  if (!me.department_id) return NextResponse.json({ error: 'Aucun service rattaché' }, { status: 400 })

  const { data, error } = await supabase.from('activity_periods').insert({
    department_id: me.department_id, label: label?.trim() || null,
    start_date, end_date, created_by: userId,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id })
}
