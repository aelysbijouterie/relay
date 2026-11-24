// Périodes d'alternance récurrentes : « tous les lundis et mardis, jusqu'au … » → une période par semaine.

export interface Period { start: string; end: string }

const DAY = 86400000
const parse = (iso: string) => Date.parse(iso.slice(0, 10) + 'T00:00:00Z')
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Nombre maximum de périodes créées d'un coup (garde-fou). */
export const MAX_RECURRING_PERIODS = 120

/**
 * Jours choisis (0 = dimanche … 6 = samedi) entre `start` et `until` inclus.
 * Les jours qui se suivent dans la même semaine forment UNE période (lundi + mardi → lundi→mardi).
 */
export function expandWeeklyPeriods(start: string, until: string, weekdays: number[]): Period[] {
  const wanted = new Set(weekdays)
  const s = parse(start); const e = parse(until)
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s || wanted.size === 0) return []
  const days: number[] = []
  for (let t = s; t <= e; t += DAY) if (wanted.has(new Date(t).getUTCDay())) days.push(t)
  const out: Period[] = []
  for (const t of days) {
    const last = out[out.length - 1]
    if (last && parse(last.end) + DAY === t) last.end = fmt(t)
    else out.push({ start: fmt(t), end: fmt(t) })
  }
  return out
}
