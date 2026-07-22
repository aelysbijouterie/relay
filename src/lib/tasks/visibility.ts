import type { Task } from '@/types'

interface VisibilityContext {
  userId: string
  departmentIds: string[]  // service actif + services additionnels de l'utilisateur
}

/**
 * Visibilité des tâches — modèle d'ESPACE PARTAGÉ + implication personnelle.
 *
 * Une tâche est visible si :
 *   - elle appartient à l'un des services de l'utilisateur (service principal
 *     ou additionnel), OU
 *   - l'utilisateur en est le créateur (même si elle est classée dans un
 *     AUTRE service — cas d'une délégation inter-services), OU
 *   - l'utilisateur y est assigné (même logique, peu importe le service).
 *
 * Règle IDENTIQUE pour tous les rôles, y compris admin : pas de vision
 * "toute l'entreprise" par défaut, uniquement ses propres services + ce qui
 * le concerne personnellement.
 *
 * Le calendrier personnel applique un filtre PLUS strict, séparément côté
 * client (uniquement créateur/assigné, sans l'ouverture par service) — ne
 * pas confondre les deux règles.
 */
export function isTaskVisibleTo(task: Task, ctx: VisibilityContext): boolean {
  if (task.department_id && ctx.departmentIds.includes(task.department_id)) return true
  if (task.created_by === ctx.userId) return true
  if ((task.assignees ?? []).some(a => a.id === ctx.userId)) return true
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
