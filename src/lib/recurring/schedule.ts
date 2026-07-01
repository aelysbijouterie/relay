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
