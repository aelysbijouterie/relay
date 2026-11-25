import type { AbsencePeriod } from '@/types/absences'

// Quelle partie d'un jour donné est absente ? Sur une absence de plusieurs jours, seuls le premier et le dernier jour
// peuvent être des demi-journées ; les jours du milieu sont toujours entiers.

export function dayPeriodOf(a: { start_date: string; end_date: string; start_period: AbsencePeriod; end_period: AbsencePeriod }, ds: string): AbsencePeriod {
  if (a.start_date === a.end_date) return a.start_period
  if (ds === a.start_date) return a.start_period
  if (ds === a.end_date) return a.end_period
  return 'full'
}

/** Repère compact pour les petites pastilles : ● journée entière, ◐ matin, ◑ après-midi. */
export const PERIOD_MARK: Record<AbsencePeriod, string> = { full: '●', am: '◐', pm: '◑' }

/** Texte clair (infobulle, liste détaillée). */
export const PERIOD_TEXT: Record<AbsencePeriod, string> = { full: 'journée entière', am: 'matin', pm: 'après-midi' }
