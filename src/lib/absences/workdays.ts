import type { AbsencePeriod } from '@/types/absences'
import { holidayName } from '@/lib/calendar/holidays'

function ds(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isHoliday(d: Date): boolean { return holidayName(ds(d)) !== null }

/** Une semaine de congés décompte au plus 5 jours (le 6e jour est le jour de repos hebdomadaire). */
export const MAX_DAYS_PER_WEEK = 5

export interface WorkdayOptions {
  /**
   * Boutiques : les magasins sont ouverts le samedi, qui peut donc être posé et décompté (lundi→samedi).
   * Chaque jour posé compte 1 jour, mais une même semaine ne décompte jamais plus de 5 jours
   * (on déduit le jour de repos) : une semaine complète = 5 jours, un samedi posé seul = 1 jour.
   */
  saturdays?: boolean
}

// Compte les jours décomptés entre deux dates incluses : lundi→vendredi, plus le samedi pour les boutiques
// (option `saturdays`, avec plafond de 5 jours par semaine). Les dimanches et les jours fériés ne comptent
// jamais. Une demi-journée en premier ou dernier jour retire 0,5 j.
export function countWorkdays(
  startDate: string, endDate: string,
  startPeriod: AbsencePeriod = 'full', endPeriod: AbsencePeriod = 'full',
  opts: WorkdayOptions = {},
): number {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (end < start) return 0

  // Un jour est décompté s'il n'est ni dimanche, ni férié, ni (hors boutique) samedi.
  const counts = (d: Date) => {
    const day = d.getDay()
    if (day === 0) return false
    if (day === 6 && !opts.saturdays) return false
    return !isHoliday(d)
  }

  const weeks = new Map<string, number>() // lundi de la semaine → jours décomptés
  const mondayOf = (d: Date) => { const m = new Date(d); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return ds(m) }
  const add = (d: Date, n: number) => { const k = mondayOf(d); weeks.set(k, (weeks.get(k) ?? 0) + n) }

  const cur = new Date(start)
  while (cur <= end) {
    if (counts(cur)) add(cur, 1)
    cur.setDate(cur.getDate() + 1)
  }
  if (weeks.size === 0) return 0

  // Demi-journées : retirées du premier / dernier jour s'ils sont décomptés.
  if (startDate === endDate) {
    if (startPeriod !== 'full' && counts(start)) add(start, -0.5)
  } else {
    if (startPeriod !== 'full' && counts(start)) add(start, -0.5)
    if (endPeriod !== 'full' && counts(end)) add(end, -0.5)
  }

  let total = 0
  for (const n of Array.from(weeks.values())) total += Math.min(MAX_DAYS_PER_WEEK, n)
  return total
}

// Le type d'absence décompte-t-il un solde, et lequel ?
export function balanceKeyForType(type: string): 'conges' | 'rtt' | null {
  if (type === 'Congés payés') return 'conges'
  if (type === 'RTT') return 'rtt'
  return null
}

/** Règle de décompte des collaborateurs de boutique (congés payés et RTT) : samedis compris, 5 jours par semaine au plus. */
export function boutiqueDayOptions(_type?: string): WorkdayOptions {
  return { saturdays: true }
}
