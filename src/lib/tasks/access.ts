import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { getBoutiqueTeamIds } from '@/lib/boutique/session'
import { PAC_MEDIA_KIT_DEPARTMENTS } from '@/types/pacMediaKit'

/**
 * Peut-on agir sur cette carte (lire ses commentaires, sous-tâches, historique, pièces jointes, la modifier…) ?
 * Même règle que le Kanban : créateur ou assigné (un compte de boutique compte aussi les collaborateurs de son magasin).
 * Exception volontaire : les cartes PAC & Média Kit (op_category) sont ouvertes à Marketing, Web et à la RH validatrice.
 */
export async function canAccessTask(userId: string, taskId: string): Promise<'ok' | 'missing' | 'denied'> {
  const supabase = createAdminClient()
  const { data: task } = await supabase
    .from('tasks').select('id, created_by, op_category, assignees:task_assignees(user_id)').eq('id', taskId).maybeSingle()
  if (!task) return 'missing'
  const ids = [userId, ...(await getBoutiqueTeamIds(supabase, userId))]
  if (task.created_by && ids.includes(task.created_by as string)) return 'ok'
  if (((task.assignees ?? []) as { user_id: string }[]).some(a => ids.includes(a.user_id))) return 'ok'
  if (task.op_category) {
    const { data: me } = await supabase
      .from('profiles').select('can_validate_boutiques, department:departments!department_id(slug), extra_department_ids').eq('id', userId).single()
    if (me?.can_validate_boutiques === true) return 'ok'
    const dept = Array.isArray(me?.department) ? me?.department[0] : me?.department
    if (PAC_MEDIA_KIT_DEPARTMENTS.includes((dept as { slug?: string } | undefined)?.slug ?? '')) return 'ok'
    const extra = (me?.extra_department_ids as string[] | null) ?? []
    if (extra.length) {
      const { data: ds } = await supabase.from('departments').select('slug').in('id', extra)
      if ((ds ?? []).some(d => PAC_MEDIA_KIT_DEPARTMENTS.includes(d.slug as string))) return 'ok'
    }
  }
  return 'denied'
}

/** À placer en tête d'une route `tasks/[id]/…` : renvoie la réponse d'erreur à retourner, ou null si l'accès est permis. */
export async function requireTaskAccess(taskId: string): Promise<NextResponse | null> {
  const userId = readSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const r = await canAccessTask(userId, taskId)
  if (r === 'missing') return NextResponse.json({ error: 'Carte introuvable' }, { status: 404 })
  if (r === 'denied') return NextResponse.json({ error: 'Accès refusé à cette carte' }, { status: 403 })
  return null
}
