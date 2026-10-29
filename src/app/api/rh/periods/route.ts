import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

async function requireHr(supabase: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const userId = getUserId()
  if (!userId) return null
  const { data } = await supabase.from('profiles').select('can_validate_boutiques').eq('id', userId).single()
  return data?.can_validate_boutiques === true ? userId : null
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

// GET : périodes saisies par la RH (changement de merch, etc.).
export async function GET() {
  const supabase = createAdminClient()
  if (!(await requireHr(supabase))) return NextResponse.json({ error: 'Accès réservé à la RH' }, { status: 403 })
  const { data, error } = await supabase
    .from('leave_blocked_periods').select('id, label, start_date, end_date, kind').order('start_date', { ascending: true })
  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}

// POST { label, start_date, end_date, kind } : ajoute une période.
// kind = 'block' (demande impossible) ou 'warning' (déconseillé).
export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const userId = await requireHr(supabase)
  if (!userId) return NextResponse.json({ error: 'Accès réservé à la RH' }, { status: 403 })

  const b = await request.json().catch(() => ({}))
  const label = typeof b.label === 'string' ? b.label.trim().slice(0, 120) : ''
  if (!label || !DATE.test(b.start_date ?? '') || !DATE.test(b.end_date ?? '') || b.end_date < b.start_date) {
    return NextResponse.json({ error: 'Libellé et dates valides requis' }, { status: 400 })
  }
  const kind = b.kind === 'warning' ? 'warning' : 'block'
  const { data, error } = await supabase
    .from('leave_blocked_periods')
    .insert({ label, start_date: b.start_date, end_date: b.end_date, kind, created_by: userId })
    .select('id, label, start_date, end_date, kind').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE ?id=… : supprime une période saisie.
export async function DELETE(request: NextRequest) {
  const supabase = createAdminClient()
  if (!(await requireHr(supabase))) return NextResponse.json({ error: 'Accès réservé à la RH' }, { status: 403 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Identifiant requis' }, { status: 400 })
  const { error } = await supabase.from('leave_blocked_periods').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
