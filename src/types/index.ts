export type Role = 'admin' | 'manager' | 'collaborateur'

export type TaskStatus = 'A Faire' | 'En cours' | 'Bloqué' | 'A revoir' | 'Terminé' | 'Archivé'

export type TaskPriority = 'Urgent' | 'Élevée' | 'Moyenne' | 'Faible'

export interface Department {
  id: string
  name: string
  color: string
  icon: string | null
  slug: string
}

export interface NotificationPreferences {
  notify_email_assigned: boolean
  notify_email_status: boolean
  notify_email_deadlines: boolean
  notify_email_weekly: boolean
  notify_email_mentions: boolean
}

export interface Profile {
  id: string
  name: string
  email: string
  department_id: string | null
  role: Role
  avatar_url: string | null
  is_active: boolean
  created_at: string
  department?: Department
  notify_email_assigned?: boolean
  notify_email_status?: boolean
  notify_email_deadlines?: boolean
  notify_email_weekly?: boolean
  notify_email_mentions?: boolean
  show_holidays?: boolean
  show_school_holidays?: boolean
  conges_default_dept_ids?: string[] | null
  show_absences_calendar?: boolean
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  department_id: string
  created_by: string
  deadline: string | null
  recurring_task_id?: string | null
  recurring?: { lead_days: number } | null
  position?: number | null
  is_cross_team: boolean
  fournisseur_client: string | null
  ref_collection: string | null
  parent_task_id: string | null
  created_at: string
  updated_at: string
  completed_at?: string | null
  department?: Department
  creator?: Profile
  assignees?: Profile[]
  extra_departments?: Department[]
  subtasks?: { status: string; deadline: string | null }[]
  tags?: Tag[]
}

export interface Attachment {
  id: string
  task_id: string
  file_url: string
  file_name: string
  uploaded_by: string | null
  created_at: string
}

export interface TaskTemplate {
  id: string
  department_id: string | null
  name: string
  default_title: string | null
  default_priority: TaskPriority
  default_description: string | null
  created_by: string | null
  created_at: string
}

export interface SavedFilter {
  id: string
  user_id: string
  name: string
  filters: {
    status?: TaskStatus[]
    priority?: TaskPriority[]
    assignees?: string[]
  }
  created_at: string
}

export const TASK_STATUSES: TaskStatus[] = [
  'A Faire', 'En cours', 'Bloqué', 'A revoir', 'Terminé'
]

export const TASK_PRIORITIES: TaskPriority[] = [
  'Urgent', 'Élevée', 'Moyenne', 'Faible'
]

export const STATUS_COLORS: Record<TaskStatus, string> = {
  'A Faire':  'var(--status-todo)',
  'En cours': 'var(--status-inprogress)',
  'Bloqué':   'var(--status-blocked)',
  'A revoir': 'var(--status-review)',
  'Terminé':  'var(--status-done)',
  'Archivé':  'var(--status-archived)',
}

// Libellé AFFICHÉ à l'écran — distinct de la valeur technique stockée en base
// (TaskStatus). Seul 'A revoir' a un libellé différent ("À valider") ; tous
// les autres statuts affichent leur valeur technique telle quelle.
export const STATUS_LABELS: Record<TaskStatus, string> = {
  'A Faire':  'A Faire',
  'En cours': 'En cours',
  'Bloqué':   'Bloqué',
  'A revoir': 'À valider',
  'Terminé':  'Terminé',
  'Archivé':  'Archivé',
}

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  'Urgent':  'var(--priority-urgent)',
  'Élevée':  'var(--priority-high)',
  'Moyenne': 'var(--priority-medium)',
  'Faible':  'var(--priority-low)',
}