import type { Task } from '@/types'

interface VisibilityContext {
  userId: string
  departmentIds: string[]  // service actif + services additionnels de l'utilisateur
}

/**
 * Visibilité des tâches — modèle PERSONNEL vs ÉQUIPE.
 *
 * Une carte est "personnelle" tant que SEULE sa créatrice est concernée
 * (aucun autre assigné) : elle reste privée, invisible du reste du service.
 * Dès qu'on y ajoute quelqu'un d'autre (délégation ou collaboration), elle
 * devient une carte d'ÉQUIPE, visible par tout le service concerné.
 *
 * Une tâche est visible si :
 *   - l'utilisateur en est le créateur (voit toujours ses propres cartes,
 *     personnelles ou non), OU
 *   - l'utilisateur y est assigné (toujours, peu importe le service), OU
 *   - la carte N'EST PAS personnelle (au moins une autre personne que la
 *     créatrice y est impliquée) ET elle appartient à l'un des services de
 *     l'utilisateur (principal ou additionnel).
 *
 * Règle IDENTIQUE pour tous les rôles, y compris admin.
 *
 * Le calendrier personnel applique un filtre PLUS strict, séparément côté
 * client (uniquement créateur/assigné, sans l'ouverture par service) — ne
 * pas confondre les deux règles.
 */

// Une carte est "personnelle" si personne d'autre que sa créatrice n'y est
// impliqué (pas d'assigné du tout, ou seulement la créatrice elle-même).
export function isPersonalCard(task: Task): boolean {
  const assignees = task.assignees ?? []
  if (assignees.length === 0) return true
  if (assignees.length === 1 && assignees[0].id === task.created_by) return true
  return false
}

export function isTaskVisibleTo(task: Task, ctx: VisibilityContext): boolean {
  if (task.created_by === ctx.userId) return true
  if ((task.assignees ?? []).some(a => a.id === ctx.userId)) return true
  if (isPersonalCard(task)) return false // jamais partagée avec le service, même si le service correspond
  if (task.department_id && ctx.departmentIds.includes(task.department_id)) return true
  return false
}

/**
 * Services d'un utilisateur : service principal + additionnels (ex : Audrey
 * en Comptabilité, responsable RH + Administratif). Utilisé pour déterminer
 * l'ensemble de tâches qu'il peut voir (voir isTaskVisibleTo ci-dessus).
 */
export async function getUserDepartmentIds(
  supabase: ReturnType<typeof import('@/lib/supabase/server').createAdminClient>,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('profiles').select('department_id, extra_department_ids').eq('id', userId).single()
  const ids = new Set<string>()
  if (data?.department_id) ids.add(data.department_id)
  for (const d of (data?.extra_department_ids as string[] | null) ?? []) ids.add(d)
  return [...ids]
}
