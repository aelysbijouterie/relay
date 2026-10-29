import type { createAdminClient } from '@/lib/supabase/server'
import { holidayName } from '@/lib/calendar/holidays'
import { addDays, evaluateLeaveRequest, weekStart, type CustomPeriod, type LeaveEvaluation } from '@/lib/absences/leaveRules'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Applique les règles de pose de congés à une demande de congés payés d'une boutique :
 * périodes calculées (soldes, Saint-Valentin, fête des mères, Black Friday → soldes de janvier),
 * périodes saisies par la RH, et règle « apprenti·e à l'école plus de 3 jours ».
 * Tolérant : si la migration 026 n'est pas encore passée, seules les règles calculées s'appliquent.
 */
export async function evaluateForBoutique(supabase: Admin, boutiqueId: string, start: string, end: string): Promise<LeaveEvaluation> {
  const { data: periods } = await supabase
    .from('leave_blocked_periods').select('label, start_date, end_date, kind')
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

  return evaluateLeaveRequest({
    start, end, custom, apprentices, school,
    isHoliday: ds => holidayName(ds) !== null,
  })
}

export { addDays }
