export type AbsenceType = 'Congés payés' | 'RTT' | 'Maladie' | 'Télétravail' | 'Alternance' | 'Autre'
export type AbsencePeriod = 'full' | 'am' | 'pm'
export type AbsenceStatus = 'En attente' | 'Validé' | 'Refusé' | 'Modif. en attente'

export interface Absence {
  id: string
  user_id: string
  type: AbsenceType
  start_date: string
  end_date: string
  start_period: AbsencePeriod
  end_period: AbsencePeriod
  reason: string | null
  status: AbsenceStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  pending_start_date?: string | null
  pending_end_date?: string | null
  pending_start_period?: AbsencePeriod | null
  pending_end_period?: AbsencePeriod | null
  // Jointures
  user?: { id: string; name: string; avatar_url: string | null; department_id: string | null; department?: { name: string; color: string } | null }
}

export const ABSENCE_TYPES: AbsenceType[] = ['Congés payés', 'RTT', 'Maladie', 'Télétravail', 'Alternance', 'Autre']

// Couleur par type d'absence (distincte de la palette des espaces).
// Couleurs propres aux absences, choisies pour ne PAS coïncider avec les
// couleurs des services (qui servent d'accent par espace).
export const ABSENCE_COLORS: Record<AbsenceType, string> = {
  'Congés payés': '#0EA5A5', // turquoise franc
  'RTT':          '#6366F1', // indigo
  'Maladie':      '#DC2626', // rouge vif (santé)
  'Télétravail':  '#0891B2', // cyan profond
  'Alternance':   '#EA9A16', // ambre
  'Autre':        '#64748B', // ardoise
}

export const ABSENCE_STATUS_COLORS: Record<AbsenceStatus, string> = {
  'En attente': '#F59E0B',
  'Validé':     '#1F9D57',
  'Refusé':     '#EF4444',
  'Modif. en attente': '#F59E0B',
}

export const PERIOD_LABELS: Record<AbsencePeriod, string> = {
  full: 'Journée', am: 'Matin', pm: 'Après-midi',
}


// Périodes d'activité (dissuasives) définies par service.
export interface ActivityPeriod {
  id: string
  department_id: string
  label: string | null
  start_date: string
  end_date: string
  created_by: string | null
  created_at: string
}
