import type { AbsencePeriod } from '@/types/absences'
import { holidayName } from '@/lib/calendar/holidays'

function ds(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isHoliday(d: Date): boolean { return holidayName(ds(d)) !== null }

// Compte les jours OUVRÉS (lundi→vendredi) entre deux dates incluses, en
// excluant les jours fériés, et en retirant une demi-journée si le premier ou
// le dernier jour est en demi-journée. Week-ends et fériés ne comptent jamais.
export function countWorkdays(
  startDate: string, endDate: string,
  startPeriod: AbsencePeriod = 'full', endPeriod: AbsencePeriod = 'full'
): number {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (end < start) return 0

  let full = 0
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6 && !isHoliday(cur)) full += 1
    cur.setDate(cur.getDate() + 1)
  }
  if (full === 0) return 0

  const startDay = start.getDay()
  const endDay = end.getDay()
  // Un jour compte comme "ouvré" seulement s'il n'est ni week-end ni férié.
  const startIsWorkday = startDay !== 0 && startDay !== 6 && !isHoliday(start)
  const endIsWorkday = endDay !== 0 && endDay !== 6 && !isHoliday(end)

  if (startDate === endDate) {
    if (startPeriod !== 'full' && startIsWorkday) return 0.5
    return full
  }
  let deduction = 0
  if (startPeriod !== 'full' && startIsWorkday) deduction += 0.5
  if (endPeriod !== 'full' && endIsWorkday) deduction += 0.5
  return full - deduction
}

// Le type d'absence décompte-t-il un solde, et lequel ?
export function balanceKeyForType(type: string): 'conges' | 'rtt' | null {
  if (type === 'Congés payés') return 'conges'
  if (type === 'RTT') return 'rtt'
  return null
}
