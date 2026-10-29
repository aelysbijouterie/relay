import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

async function requireHr(supabase: ReturnType<typeof createAdminClient>, userId: string | null): Promise<boolean> {
  if (!userId) return false
  const { data } = await supabase.from('profiles').select('can_validate_boutiques').eq('id', userId).single()
  return data?.can_validate_boutiques === true
}

// GET : vue d'ensemble pour la RH — boutiques, collaborateurs (avec solde de CP)
// et toutes les absences des boutiques. Réservé à la validatrice RH.
export async function GET() {
  const supabase = createAdminClient()
  if (!(await requireHr(supabase, getUserId()))) return NextResponse.json({ error: 'Accès réservé à la RH' }, { status: 403 })

  const [{ data: boutiques }, { data: members }, { data: absences }] = await Promise.all([
    supabase.from('boutiques').select('id, code, name, city, responsable').eq('is_active', true).order('code'),
    supabase.from('profiles').select('id, name, boutique_id, leave_balance_conges, leave_balance_since, contract_type')
      .eq('is_boutique_account', false).not('boutique_id', 'is', null).order('name'),
    supabase.from('absences').select(`
      id, user_id, type, start_date, end_date, start_period, end_period, reason, status,
      reviewed_by, reviewed_at, review_note, created_at,
      pending_start_date, pending_end_date, pending_start_period, pending_end_period,
      user:profiles!user_id(id, name, boutique_id)
    `).order('start_date', { ascending: false }),
  ])

  const rows = (absences ?? [])
    .map((a: Record<string, unknown>) => ({ ...a, user: Array.isArray(a.user) ? a.user[0] : a.user }))
    .filter(a => !!(a.user as { boutique_id?: string | null } | undefined)?.boutique_id)

  return NextResponse.json(
    { boutiques: boutiques ?? [], members: members ?? [], absences: rows },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// PUT { user_id, conges } : la RH fixe le solde annuel de congés payés d'un collaborateur de boutique.
export async function PUT(request: NextRequest) {
  const supabase = createAdminClient()
  if (!(await requireHr(supabase, getUserId()))) return NextResponse.json({ error: 'Accès réservé à la RH' }, { status: 403 })

  const { user_id, conges } = await request.json().catch(() => ({}))
  if (typeof user_id !== 'string') return NextResponse.json({ error: 'Collaborateur requis' }, { status: 400 })
  const value = conges === '' || conges === null || conges === undefined ? null : Number(conges)
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
    return NextResponse.json({ error: 'Solde invalide' }, { status: 400 })
  }

  // Seuls les collaborateurs de boutique sont concernés.
  const { data: target } = await supabase
    .from('profiles').select('id, boutique_id, is_boutique_account').eq('id', user_id).single()
  if (!target?.boutique_id || target.is_boutique_account) return NextResponse.json({ error: 'Collaborateur inconnu' }, { status: 404 })

  const { error } = await supabase.from('profiles').update({ leave_balance_conges: value }).eq('id', user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
