import type { Task } from '@/types'

// Échéance EFFECTIVE d'une carte : la sienne si elle en a une, sinon la plus
// proche parmi ses sous-tâches non cochées (voir TaskCard). Centralisé ici
// pour que le Kanban, le Focus du jour, etc. utilisent tous la même règle.
export function effectiveDeadline(task: Task): string | null {
  if (task.deadline) return task.deadline
  const pending = (task.subtasks ?? [])
    .filter(s => s.status !== 'Terminé' && s.deadline)
    .map(s => s.deadline as string)
    .sort()
  return pending[0] ?? null
}

// L'échéance affichée vient-elle d'une sous-tâche (et non de la carte elle-même) ?
export function isDeadlineFromSubtask(task: Task): boolean {
  return !task.deadline && !!effectiveDeadline(task)
}
