import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getActingContext } from '@/lib/boutique/session'
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

  // Boutique : soldes du collaborateur choisi (jamais ceux du compte de la boutique).
  const ctx = await getActingContext(supabase, userId)
  const targetId = ctx.actingUserId
  if (!targetId) return NextResponse.json({ conges: { start: null, taken: 0, remaining: null }, rtt: { start: null, taken: 0, remaining: null } })

  const { data: profile } = await supabase
    .from('profiles').select('leave_balance_conges, leave_balance_rtt, leave_balance_since, leave_acquiring, leave_split_days, is_cadre').eq('id', targetId).single()

  // Absences validées de l'utilisateur pour l'année en cours
  const year = new Date().getFullYear()
  const { data: absences } = await supabase
    .from('absences')
    .select('type, start_date, end_date, start_period, end_period')
    .eq('user_id', targetId).eq('status', 'Validé')
    .gte('start_date', profile?.leave_balance_since ?? `${year}-01-01`)
    .lte('start_date', profile?.leave_balance_since ? '9999-12-31' : `${year}-12-31`)

  let takenConges = 0, takenRtt = 0
  for (const a of absences ?? []) {
    const key = balanceKeyForType(a.type)
    if (!key) continue
    const d = countWorkdays(a.start_date, a.end_date, a.start_period, a.end_period)
    if (key === 'conges') takenConges += d; else takenRtt += d
  }

  // Congés payés demandés mais pas encore validés (comptés pour savoir ce qu'il restera vraiment).
  const { data: pendingRows } = await supabase
    .from('absences')
    .select('start_date, end_date, start_period, end_period')
    .eq('user_id', targetId).eq('type', 'Congés payés').in('status', ['En attente', 'Modif. en attente'])
  const pending = (pendingRows ?? []).reduce((s, a) => s + countWorkdays(a.start_date, a.end_date, a.start_period, a.end_period), 0)
  const { data: pendingRttRows } = await supabase
    .from('absences')
    .select('start_date, end_date, start_period, end_period')
    .eq('user_id', targetId).eq('type', 'RTT').in('status', ['En attente', 'Modif. en attente'])
  const pendingRtt = (pendingRttRows ?? []).reduce((s, a) => s + countWorkdays(a.start_date, a.end_date, a.start_period, a.end_period), 0)
  // Jours de fractionnement (ajoutés à la main par la RH) : ils s'ajoutent aux jours acquis.
  const split = Number(profile?.leave_split_days ?? 0)

  const startConges = profile?.leave_balance_conges
  const startRtt = profile?.leave_balance_rtt
  return NextResponse.json({
    conges: { start: startConges, taken: takenConges, remaining: startConges != null ? startConges + split - takenConges : null },
    rtt:    { start: startRtt,    taken: takenRtt,    remaining: startRtt != null ? startRtt - takenRtt : null },
    pending,                                              // jours de CP en attente de validation
    pendingRtt,                                           // jours de RTT en attente de validation
    split,                                                // dont jours de fractionnement
    is_cadre: profile?.is_cadre === true,                 // accès aux RTT
    acquiring: Number(profile?.leave_acquiring ?? 0),     // jours en cours d'acquisition
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

  const ctx = await getActingContext(supabase, userId)
  // Les soldes d'une boutique sont gérés par la RH uniquement.
  if (ctx.isBoutique) return NextResponse.json({ error: 'Les soldes sont gérés par la RH' }, { status: 403 })
  if (!ctx.actingUserId) return NextResponse.json({ error: "Choisis d'abord le collaborateur concerné" }, { status: 400 })
  const { error } = await supabase.from('profiles').update(updates).eq('id', ctx.actingUserId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
