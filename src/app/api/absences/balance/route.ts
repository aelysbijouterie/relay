import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { countWorkdays, balanceKeyForType } from '@/lib/absences/workdays'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// GET : soldes de départ + jours déjà pris (absences validées) + restant.
export async function GET() {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles').select('leave_balance_conges, leave_balance_rtt').eq('id', userId).single()

  // Absences validées de l'utilisateur pour l'année en cours
  const year = new Date().getFullYear()
  const { data: absences } = await supabase
    .from('absences')
    .select('type, start_date, end_date, start_period, end_period')
    .eq('user_id', userId).eq('status', 'Validé')
    .gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`)

  let takenConges = 0, takenRtt = 0
  for (const a of absences ?? []) {
    const key = balanceKeyForType(a.type)
    if (!key) continue
    const d = countWorkdays(a.start_date, a.end_date, a.start_period, a.end_period)
    if (key === 'conges') takenConges += d; else takenRtt += d
  }

  const startConges = profile?.leave_balance_conges
  const startRtt = profile?.leave_balance_rtt
  return NextResponse.json({
    conges: { start: startConges, taken: takenConges, remaining: startConges != null ? startConges - takenConges : null },
    rtt:    { start: startRtt,    taken: takenRtt,    remaining: startRtt != null ? startRtt - takenRtt : null },
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST : chacun définit ses propres soldes de départ.
export async function POST(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { conges, rtt } = await request.json()
  const supabase = createAdminClient()

  const updates: Record<string, number | null> = {}
  if (conges !== undefined) updates.leave_balance_conges = conges === '' || conges === null ? null : Number(conges)
  if (rtt !== undefined)    updates.leave_balance_rtt    = rtt === '' || rtt === null ? null : Number(rtt)

  const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
