import type { RecurringFrequency } from '@/types/recurring'

// jour de semaine "lundi=0 … dimanche=6"
function weekdayMon0(date: Date): number { return (date.getDay() + 6) % 7 }
function isWorkday(date: Date): boolean { const w = weekdayMon0(date); return w >= 0 && w <= 4 }

// Premier jour ouvré du mois de `date`
function firstWorkdayOfMonth(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), 1)
  while (!isWorkday(d)) d.setDate(d.getDate() + 1)
  return d.getDate()
}
// Dernier jour ouvré du mois de `date`
function lastWorkdayOfMonth(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  while (!isWorkday(d)) d.setDate(d.getDate() - 1)
  return d.getDate()
}

// Un modèle est-il dû à la date donnée ?
export function isDue(
  frequency: RecurringFrequency,
  opts: { weekday?: number | null; month_day?: number | null },
  date: Date
): boolean {
  switch (frequency) {
    case 'daily':
      return isWorkday(date)
    case 'weekly':
      return opts.weekday != null && weekdayMon0(date) === opts.weekday
    case 'monthly_day': {
      if (opts.month_day == null) return false
      // Si le jour demandé dépasse le nombre de jours du mois (ex : 31 en février),
      // on déclenche le dernier jour du mois.
      const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
      const target = Math.min(opts.month_day, daysInMonth)
      return date.getDate() === target
    }
    case 'monthly_first':
      return date.getDate() === firstWorkdayOfMonth(date)
    case 'monthly_last':
      return date.getDate() === lastWorkdayOfMonth(date)
    default:
      return false
  }
}

// Format 'YYYY-MM-DD' local
function ds(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Toutes les dates d'échéance d'un modèle dans l'intervalle [from, to] inclus.
// Sert aux projections du calendrier ET au cron (échéances proches).
export function occurrencesInRange(
  frequency: RecurringFrequency,
  opts: { weekday?: number | null; month_day?: number | null },
  from: Date, to: Date
): string[] {
  const out: string[] = []
  if (to < from) return out
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  let guard = 0
  while (cur <= end && guard < 2000) {
    if (isDue(frequency, opts, cur)) out.push(ds(cur))
    cur.setDate(cur.getDate() + 1)
    guard++
  }
  return out
}
