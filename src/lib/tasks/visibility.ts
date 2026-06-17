import type { Task } from '@/types'

interface VisibilityContext {
  userId: string
}

/**
 * Visibilité personnelle des tâches.
 *
 * Règle (identique pour TOUS les rôles, admins et managers compris) :
 * un utilisateur voit une tâche uniquement si
 *   - il l'a créée lui-même (task.created_by), OU
 *   - il y est assigné (task.assignees).
 *
 * Aucune visibilité par département : le tableau de bord est un espace
 * personnel, chacun ne voit que ce qui le concerne directement, quel que
 * soit le département d'origine de la tâche.
 *
 * ATTENTION : toutes les routes serveur de RELAYS lisent via le client
 * admin (service role key), qui bypass les policies RLS. C'est donc ici,
 * et uniquement ici, que cette règle est réellement appliquée. Toute
 * route qui renvoie une liste de tâches à un utilisateur doit filtrer
 * avec cette fonction. Ne pas dupliquer la logique ailleurs.
 */
export function isTaskVisibleTo(task: Task, user: VisibilityContext): boolean {
  if (task.created_by === user.userId) return true
  if ((task.assignees ?? []).some(a => a.id === user.userId)) return true
  return false
}