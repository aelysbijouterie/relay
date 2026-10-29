import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { countWorkdays } from '@/lib/absences/workdays'

export const dynamic = 'force-dynamic'

const MONTHLY_ACCRUAL = 2.08 // 25 jours / 12 mois, tel qu'utilisé dans le classeur des compteurs
const YEAR_TOTAL = 25
const round2 = (n: number) => Math.round(n * 100) / 100

// Cron du 1er de chaque mois (03:00 UTC), collaborateurs des boutiques uniquement :
//  1. +2,08 jour « en cours d'acquisition » (plafonné à 25) — correspond au mois qui vient de s'écouler ;
//  2. le 1er JUIN : bascule — les jours en acquisition passent en jours acquis (25 pour une année
//     complète), le compteur d'acquisition repart à 0 et la nouvelle période commence.
// Garde-fou : leave_accrual_runs empêche toute double exécution sur un même mois.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const isJune = now.getUTCMonth() === 5
  const supabase = createAdminClient()

  const { error: lockErr } = await supabase.from('leave_accrual_runs').insert({ period })
  if (lockErr) return NextResponse.json({ skipped: true, reason: 'déjà exécuté ou table absente', period })

  const { data: members, error } = await supabase
    .from('profiles')
    .select('id, leave_balance_conges, leave_acquiring')
    .eq('is_boutique_account', false).not('boutique_id', 'is', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bascule du 1er juin : jours déjà validés dans RELAYS sur la période qui se termine.
  const takenBeforeJune = new Map<string, number>()
  const juneFirst = `${now.getUTCFullYear()}-06-01`
  if (isJune) {
    const { data: rows } = await supabase
      .from('absences').select('user_id, start_date, end_date, start_period, end_period')
      .eq('type', 'Congés payés').eq('status', 'Validé')
      .in('user_id', (members ?? []).map(m => m.id as string)).lt('start_date', juneFirst)
    // Seuls les congés validés APRÈS la date d'import du solde ont été déduits du solde acquis.
    const { data: sinceRows } = await supabase.from('profiles').select('id, leave_balance_since').in('id', (members ?? []).map(m => m.id as string))
    const since = new Map((sinceRows ?? []).map(r => [r.id as string, r.leave_balance_since as string | null]))
    for (const a of rows ?? []) {
      const s = since.get(a.user_id as string)
      if (s && (a.start_date as string) < s) continue
      takenBeforeJune.set(a.user_id as string, (takenBeforeJune.get(a.user_id as string) ?? 0)
        + countWorkdays(a.start_date as string, a.end_date as string, a.start_period as 'full' | 'am' | 'pm', a.end_period as 'full' | 'am' | 'pm'))
    }
  }

  let updated = 0
  for (const m of members ?? []) {
    let acquiring = Math.min(YEAR_TOTAL, round2(Number(m.leave_acquiring ?? 0) + MONTHLY_ACCRUAL))
    const update: Record<string, unknown> = {}
    if (isJune) {
      const gained = acquiring >= 24.9 ? YEAR_TOTAL : acquiring // 12 × 2,08 = 24,96 → 25 jours pleins
      const remaining = Number(m.leave_balance_conges ?? 0) - (takenBeforeJune.get(m.id as string) ?? 0)
      update.leave_balance_conges = round2(remaining + gained)
      update.leave_balance_since = juneFirst
      update.leave_taken_period = 0
      acquiring = 0
    }
    update.leave_acquiring = acquiring
    const { error: upErr } = await supabase.from('profiles').update(update).eq('id', m.id)
    if (!upErr) updated++
  }
  return NextResponse.json({ period, bascule: isJune, updated, total: members?.length ?? 0 })
}
