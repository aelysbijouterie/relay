export type RecurringFrequency = 'weekly' | 'monthly_day' | 'monthly_first' | 'monthly_last' | 'daily'

export interface RecurringTask {
  id: string
  title: string
  description: string | null
  priority: string
  department_id: string | null
  created_by: string | null
  frequency: RecurringFrequency
  weekday: number | null      // 0 = lundi … 6 = dimanche (pour 'weekly')
  month_day: number | null    // 1..31 (pour 'monthly_day')
  assignee_ids: string[]
  is_active: boolean
  last_run_date: string | null
  created_at: string
  department?: { id: string; name: string; color: string } | null
}

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Chaque semaine',
  monthly_day: 'Jour fixe du mois',
  monthly_first: 'Premier jour ouvré du mois',
  monthly_last: 'Dernier jour ouvré du mois',
  daily: 'Chaque jour ouvré',
}

export const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
