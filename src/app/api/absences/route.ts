import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// GET : toutes les absences (tout le monde voit tout), avec infos utilisateur.
// Filtre optionnel ?from=YYYY-MM-DD&to=YYYY-MM-DD pour une plage.
export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  let query = supabase
    .from('absences')
    .select(`
      id, user_id, type, start_date, end_date, start_period, end_period,
      reason, status, reviewed_by, reviewed_at, review_note, created_at,
      user:profiles!user_id(id, name, avatar_url, department_id, department:departments!department_id(name, color))
    `)
    .order('start_date', { ascending: true })

  if (from) query = query.gte('end_date', from)
  if (to)   query = query.lte('start_date', to)

  const { data, error } = await query
  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })

  const mapped = (data ?? []).map((a: Record<string, unknown>) => ({
    ...a,
    user: Array.isArray(a.user) ? a.user[0] : a.user,
  }))
  return NextResponse.json(mapped, { headers: { 'Cache-Control': 'no-store' } })
}

// POST : créer une demande d'absence (statut "En attente").
export async function POST(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const { type, start_date, end_date, start_period, end_period, reason } = body

  if (!type || !start_date || !end_date) {
    return NextResponse.json({ error: 'Type et dates requis' }, { status: 400 })
  }
  if (new Date(end_date) < new Date(start_date)) {
    return NextResponse.json({ error: 'La date de fin doit être après la date de début' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('absences')
    .insert({
      user_id: userId,
      type,
      start_date,
      end_date,
      start_period: start_period ?? 'full',
      end_period: end_period ?? 'full',
      reason: reason?.trim() || null,
      status: 'En attente',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id })
}
