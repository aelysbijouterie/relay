import type { Task } from '@/types'

interface VisibilityContext {
  userId: string
  /** Compte de boutique : identifiants des collaborateurs du magasin (cartes qui leur sont assignées). */
  teamIds?: string[]
}

/**
 * Visibilité des tâches — modèle STRICTEMENT PERSONNEL.
 *
 * Une carte n'est visible QUE par sa créatrice et ses assigné(s) — jamais
 * automatiquement par le reste du service, même si plusieurs personnes du
 * même service y sont impliquées. Le partage se fait uniquement en
 * assignant explicitement quelqu'un à la carte, jamais par appartenance à
 * un service.
 *
 * Règle IDENTIQUE pour tous les rôles, y compris admin. Un compte de boutique voit aussi les cartes
 * assignées à l'un des collaborateurs de son magasin (une assignation en sous-tâche ajoute la personne à la carte).
 *
 * Le calendrier personnel applique le même principe (créateur/assigné),
 * de façon indépendante côté client.
 */
export function isTaskVisibleTo(task: Task, ctx: VisibilityContext): boolean {
  const ids = [ctx.userId, ...(ctx.teamIds ?? [])]
  if (task.created_by && ids.includes(task.created_by)) return true
  if ((task.assignees ?? []).some(a => ids.includes(a.id))) return true
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
