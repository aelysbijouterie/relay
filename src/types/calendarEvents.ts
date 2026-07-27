export type EventCategory = 'reunion' | 'anniversaire' | 'autre'

export interface CalendarEvent {
  id: string
  title: string
  event_date: string        // 'YYYY-MM-DD'
  event_time: string | null  // 'HH:MM' ou null
  note: string | null
  category: EventCategory
  is_recurring_yearly: boolean
  is_shared: boolean
  department_id: string | null
  created_by: string | null
  created_at: string
  department?: { id: string; name: string; color: string } | null
}

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  reunion: 'Réunion',
  anniversaire: 'Anniversaire',
  autre: 'Autre',
}

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  reunion: '#3B82F6',      // bleu
  anniversaire: '#F59E0B', // ambre
  autre: '#8B72C4',        // violet
}

// Une date locale 'YYYY-MM-DD'
export function dsLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// L'événement a-t-il lieu à cette date ? (gère la récurrence annuelle : ne
// compare que le jour et le mois, pas l'année, si is_recurring_yearly).
export function eventOccursOn(event: CalendarEvent, date: Date): boolean {
  const ds = dsLocal(date)
  if (event.is_recurring_yearly) {
    const [, m, d] = event.event_date.split('-')
    const [, dm, dd] = ds.split('-')
    return m === dm && d === dd
  }
  return event.event_date === ds
}
