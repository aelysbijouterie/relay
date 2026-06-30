export type AbsenceType = 'Congés payés' | 'RTT' | 'Maladie' | 'Télétravail' | 'Autre'
export type AbsencePeriod = 'full' | 'am' | 'pm'
export type AbsenceStatus = 'En attente' | 'Validé' | 'Refusé'

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
  // Jointures
  user?: { id: string; name: string; avatar_url: string | null; department_id: string | null; department?: { name: string; color: string } | null }
}

export const ABSENCE_TYPES: AbsenceType[] = ['Congés payés', 'RTT', 'Maladie', 'Télétravail', 'Autre']

// Couleur par type d'absence (distincte de la palette des espaces).
export const ABSENCE_COLORS: Record<AbsenceType, string> = {
  'Congés payés': '#2A9D8F', // vert-bleu : repos
  'RTT':          '#3E8FCC', // bleu
  'Maladie':      '#E0596A', // rouge doux
  'Télétravail':  '#8B72C4', // violet : présent mais à distance
  'Autre':        '#8A8F9C', // gris
}

export const ABSENCE_STATUS_COLORS: Record<AbsenceStatus, string> = {
  'En attente': '#F59E0B',
  'Validé':     '#1F9D57',
  'Refusé':     '#EF4444',
}

export const PERIOD_LABELS: Record<AbsencePeriod, string> = {
  full: 'Journée', am: 'Matin', pm: 'Après-midi',
}
