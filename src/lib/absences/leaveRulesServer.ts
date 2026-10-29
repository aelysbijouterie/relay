import type { createAdminClient } from '@/lib/supabase/server'
import { holidayName } from '@/lib/calendar/holidays'
import { countWorkdays } from '@/lib/absences/workdays'
import {
  evaluateLeaveRequest, leavePeriod, weekStart, LEAVE_PERIOD_CAP_DAYS,
  type CustomPeriod, type LeaveEvaluation,
} from '@/lib/absences/leaveRules'
import type { AbsencePeriod } from '@/types/absences'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Applique les règles de pose de congés à une demande de congés payés d'une boutique :
 * périodes calculées (soldes, Saint-Valentin, fête des mères, Black Friday → soldes de janvier),
 * périodes saisies par la RH (toutes boutiques, ou propres à cette boutique), règle « apprenti·e à
 * l'école plus de 3 jours », et plafond de 5 semaines (25 jours) par période du 1er juin au 31 mai.
 * Tolérant : si une migration n'est pas encore passée, les règles correspondantes sont ignorées.
 */
export async function evaluateForBoutique(
  supabase: Admin, boutiqueId: string, start: string, end: string,
  opts: { memberId?: string | null; startPeriod?: AbsencePeriod; endPeriod?: AbsencePeriod; excludeAbsenceId?: string | null; applyCap?: boolean } = {},
): Promise<LeaveEvaluation> {
  const { data: periods } = await supabase
    .from('leave_blocked_periods').select('label, start_date, end_date, kind')
    .or(`boutique_id.is.null,boutique_id.eq.${boutiqueId}`)
    .lte('start_date', end).gte('end_date', start)
  const custom: CustomPeriod[] = (periods ?? []).map(p => ({
    label: p.label as string, start: p.start_date as string, end: p.end_date as string,
    kind: p.kind === 'warning' ? 'warning' : 'block',
  }))

  const { data: apps } = await supabase
    .from('profiles').select('id, name')
    .eq('boutique_id', boutiqueId).eq('is_boutique_account', false).ilike('contract_type', 'apprenti%')
  const apprentices = (apps ?? []).map(a => ({ id: a.id as string, name: a.name as string }))

  let school: { user_id: string; start_date: string; end_date: string }[] = []
  if (apprentices.length > 0) {
    const { data: entries } = await supabase
      .from('absences').select('user_id, start_date, end_date')
      .eq('type', 'Alternance').neq('status', 'Refusé')
      .in('user_id', apprentices.map(a => a.id))
      .lte('start_date', end).gte('end_date', weekStart(start))
    school = (entries ?? []) as typeof school
  }

  // Plafond de 5 semaines sur la période du 1er juin au 31 mai
  let cap: { limit: number; used: number; requested: number } | undefined
  if (opts.memberId && opts.applyCap !== false) { // plafond de 5 semaines : congés payés seulement (pas les RTT)
    const period = leavePeriod(start)
    const requested = countWorkdays(start, end, opts.startPeriod ?? 'full', opts.endPeriod ?? 'full')
    let q = supabase
      .from('absences').select('id, start_date, end_date, start_period, end_period')
      .eq('user_id', opts.memberId).eq('type', 'Congés payés').neq('status', 'Refusé')
      .gte('start_date', period.start).lte('start_date', period.end)
    if (opts.excludeAbsenceId) q = q.neq('id', opts.excludeAbsenceId)
    const { data: mine } = await q
    let used = (mine ?? []).reduce((sum, a) =>
      sum + countWorkdays(a.start_date as string, a.end_date as string, a.start_period as AbsencePeriod, a.end_period as AbsencePeriod), 0)
    // Jours pris avant RELAYS : ne concernent que la période en cours (celle de l'import).
    const today = new Date().toISOString().slice(0, 10)
    if (leavePeriod(today).start === period.start) {
      const { data: me } = await supabase.from('profiles').select('leave_taken_period').eq('id', opts.memberId).single()
      used += Number(me?.leave_taken_period ?? 0)
    }
    cap = { limit: LEAVE_PERIOD_CAP_DAYS, used, requested }
  }

  return evaluateLeaveRequest({
    start, end, custom, apprentices, school, cap,
    isHoliday: ds => holidayName(ds) !== null,
  })
}
