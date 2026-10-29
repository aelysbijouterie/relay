// Règles de pose de congés des boutiques — logique pure (sans import), utilisée
// côté serveur (refus d'office) ET côté client (alerte en direct, onglet RH).
//
// Semaines = lundi → dimanche. Toutes les dates sont des chaînes 'YYYY-MM-DD',
// calculées en UTC pour éviter tout décalage de fuseau horaire.

export interface RulePeriod { label: string; start: string; end: string }

const DAY = 86400000
const toDate = (ds: string) => { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const toStr = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (ds: string, n: number) => toStr(new Date(toDate(ds).getTime() + n * DAY))
const dow = (ds: string) => (toDate(ds).getUTCDay() + 6) % 7 // 0 = lundi … 6 = dimanche

export function weekStart(ds: string): string { return addDays(ds, -dow(ds)) }
export function weekEnd(ds: string): string { return addDays(weekStart(ds), 6) }

function nthWeekday(year: number, month: number, weekday0Sun: number, n: number): string {
  // n-ième (1…) jour de semaine donné (0 = dimanche) du mois (1-12)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const offset = (weekday0Sun - first.getUTCDay() + 7) % 7
  return toStr(new Date(Date.UTC(year, month - 1, 1 + offset + (n - 1) * 7)))
}
function lastWeekday(year: number, month: number, weekday0Sun: number): string {
  const last = new Date(Date.UTC(year, month, 0)) // dernier jour du mois
  const back = (last.getUTCDay() - weekday0Sun + 7) % 7
  return toStr(new Date(last.getTime() - back * DAY))
}

function easter(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return toStr(new Date(Date.UTC(year, month - 1, day)))
}

/** Fête des mères : dernier dimanche de mai, sauf s'il tombe sur la Pentecôte → premier dimanche de juin. */
export function mothersDay(year: number): string {
  const lastSundayMay = lastWeekday(year, 5, 0)
  const pentecost = addDays(easter(year), 49)
  return lastSundayMay === pentecost ? nthWeekday(year, 6, 0, 1) : lastSundayMay
}

/** Premier jour des soldes d'hiver : 2e mercredi de janvier, ou le mercredi précédent s'il tombe après le 12. */
export function winterSalesStart(year: number): string {
  const second = nthWeekday(year, 1, 3, 2)
  return Number(second.slice(8)) > 12 ? addDays(second, -7) : second
}

/** Premier jour des soldes d'été : dernier mercredi de juin, ou le précédent s'il tombe après le 28. */
export function summerSalesStart(year: number): string {
  const last = lastWeekday(year, 6, 3)
  return Number(last.slice(8)) > 28 ? addDays(last, -7) : last
}

/** Black Friday : le vendredi suivant le 4e jeudi de novembre. */
export function blackFriday(year: number): string { return addDays(nthWeekday(year, 11, 4, 4), 1) }

/**
 * Périodes refusées d'office, calculées automatiquement pour une année :
 *  • semaine de la Saint-Valentin • semaine de la fête des mères
 *  • 1re semaine des soldes d'hiver et d'été
 *  • de la semaine du Black Friday jusqu'à la 1re semaine des soldes de janvier suivant (Noël compris).
 */
export function automaticBlockedPeriods(year: number): RulePeriod[] {
  const out: RulePeriod[] = []
  const vd = `${year}-02-14`
  out.push({ label: 'Semaine de la Saint-Valentin', start: weekStart(vd), end: weekEnd(vd) })
  const md = mothersDay(year)
  out.push({ label: 'Semaine de la fête des mères', start: weekStart(md), end: weekEnd(md) })
  const ws = winterSalesStart(year)
  out.push({ label: 'Première semaine des soldes d\'hiver', start: ws, end: addDays(ws, 6) })
  const ss = summerSalesStart(year)
  out.push({ label: 'Première semaine des soldes d\'été', start: ss, end: addDays(ss, 6) })
  const bf = blackFriday(year)
  out.push({ label: 'Black Friday → soldes de janvier (Noël compris)', start: weekStart(bf), end: addDays(winterSalesStart(year + 1), 6) })
  return out
}

/** Période de congés (du 1er juin au 31 mai) qui contient la date. */
export function leavePeriod(ds: string): { start: string; end: string } {
  const y = Number(ds.slice(0, 4))
  const startYear = Number(ds.slice(5, 7)) >= 6 ? y : y - 1
  return { start: `${startYear}-06-01`, end: `${startYear + 1}-05-31` }
}

/** Plafond de congés payés posés sur une période : 5 semaines = 25 jours ouvrés. */
export const LEAVE_PERIOD_CAP_DAYS = 25

export interface CustomPeriod extends RulePeriod { kind: 'block' | 'warning' }

export interface Apprentice { id: string; name: string }
export interface SchoolEntry { user_id: string; start_date: string; end_date: string }

export interface LeaveEvaluation { blocks: string[]; warnings: string[] }

const overlaps = (aS: string, aE: string, bS: string, bE: string) => aS <= bE && aE >= bS

/**
 * Évalue une demande de congés payés d'une boutique.
 *  • blocks   = la demande est impossible (refus d'office)
 *  • warnings = simple avertissement (périodes « déconseillées » saisies par la RH)
 * Règle « apprenti·e » : si, dans une semaine touchée par la demande, un·e apprenti·e de la
 * boutique est à l'école plus de 3 jours ouvrés (périodes « Alternance »), la demande est impossible.
 */
export function evaluateLeaveRequest(input: {
  start: string
  end: string
  custom: CustomPeriod[]
  apprentices: Apprentice[]
  school: SchoolEntry[]
  isHoliday?: (ds: string) => boolean
  /** Plafond de la période : jours déjà pris/posés + jours demandés ne doivent pas dépasser `limit`. */
  cap?: { limit: number; used: number; requested: number }
}): LeaveEvaluation {
  const { start, end } = input
  const blocks: string[] = []
  const warnings: string[] = []
  const isHoliday = input.isHoliday ?? (() => false)

  const y0 = Number(start.slice(0, 4)), y1 = Number(end.slice(0, 4))
  for (let y = y0 - 1; y <= y1; y++) {
    for (const p of automaticBlockedPeriods(y)) {
      if (overlaps(p.start, p.end, start, end) && !blocks.includes(p.label)) blocks.push(p.label)
    }
  }
  for (const p of input.custom) {
    if (!overlaps(p.start, p.end, start, end)) continue
    const target = p.kind === 'block' ? blocks : warnings
    if (!target.includes(p.label)) target.push(p.label)
  }

  // Semaines (lundi→dimanche) touchées par la demande
  for (let ws = weekStart(start); ws <= end; ws = addDays(ws, 7)) {
    const we = addDays(ws, 4) // vendredi : on compte les jours ouvrés
    for (const a of input.apprentices) {
      let days = 0
      for (let d = ws; d <= we; d = addDays(d, 1)) {
        if (isHoliday(d)) continue
        if (input.school.some(s => s.user_id === a.id && s.start_date <= d && s.end_date >= d)) days++
      }
      if (days > 3) {
        const label = `${a.name} est à l'école plus de 3 jours (semaine du ${ws.split('-').reverse().join('/')})`
        if (!blocks.includes(label)) blocks.push(label)
      }
    }
  }
  if (input.cap && input.cap.used + input.cap.requested > input.cap.limit) {
    const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
    blocks.push(`Maximum 5 semaines (${input.cap.limit} jours) de congés payés par période du 1er juin au 31 mai : ${fmt(input.cap.used)} j déjà pris ou posés + ${fmt(input.cap.requested)} j demandés`)
  }
  return { blocks, warnings }
}
