import { NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getActingContext } from '@/lib/boutique/session'
import { PAC_MEDIA_KIT_DEPARTMENTS } from '@/types/pacMediaKit'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  return readSessionUserId()
}

// GET : toutes les opérations PAC & Média Kit des services Marketing + Web, pour tout utilisateur connecté.
// Exception VOLONTAIRE à la visibilité stricte du Kanban (créateur/assigné
// uniquement) : ce planning est un vrai outil d'équipe, décidé ensemble —
// tout le monde dans ces deux services voit toutes les opérations, qu'il y
// soit assigné ou non.
export async function GET() {
  const userId = getUserId()
  if (!userId) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })

  const supabase = createAdminClient()

  const ctx = await getActingContext(supabase, userId)

  // Vérifie que l'utilisateur appartient bien à Marketing ou Web (principal
  // ou additionnel) avant de lui donner cette vision élargie.
  const { data: profile } = await supabase
    .from('profiles')
    .select('department_id, extra_department_ids, can_validate_boutiques, department:departments!department_id(slug)')
    .eq('id', userId)
    .single()

  const primaryDept = Array.isArray(profile?.department) ? profile?.department[0] : profile?.department
  const { data: extraDepts } = profile?.extra_department_ids?.length
    ? await supabase.from('departments').select('id, slug').in('id', profile.extra_department_ids)
    : { data: [] }

  const mySlug = (primaryDept as { slug?: string } | undefined)?.slug
  const myExtraSlugs = (extraDepts ?? []).map((d: { slug: string }) => d.slug)
  // TOUT utilisateur connecté voit le planning (information commerciale pour tous). Les données internes
  // (montants, références, description, équipe) restent réservées à Marketing/Web et à la RH validatrice.
  const isFull = !ctx.isBoutique && (profile?.can_validate_boutiques === true
    || PAC_MEDIA_KIT_DEPARTMENTS.includes(mySlug ?? '') || myExtraSlugs.some(s => PAC_MEDIA_KIT_DEPARTMENTS.includes(s)))

  // Toute carte portant une catégorie PAC / Média Kit apparaît, quel que soit son service, sans assignation ni mention.

  // Même forme que /api/tasks, pour que chaque carte renvoyée soit directement
  // utilisable par TaskModal (pas de re-fetch, pas de champ manquant).
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id, title, description, status, priority, deadline, position, recurring_task_id, completed_at,
      op_category, op_date_debut, op_date_fin, op_mecanique, op_cgv, op_exclusions, op_commentaires, op_montant, op_references,
      is_cross_team, fournisseur_client, ref_collection,
      parent_task_id, created_at, updated_at, department_id, created_by,
      department:departments!department_id(id, name, color, slug, icon),
      assignees:task_assignees(
        user:profiles(id, name, email, avatar_url, role, department_id,
          department:departments(id, name, color, slug))
      ),
      extra_departments:task_departments(department:departments(id, name, color, slug)),
      tags:task_tags(tag:tags(id, name, color))
    `)
    .not('op_category', 'is', null)
    .is('deleted_at', null)
    // Les cartes archivées restent au planning : une opération terminée doit rester visible pour tous.

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })

  const mapped = (data ?? []).map((t: Record<string, unknown>) => ({
    ...t,
    assignees: ((t.assignees as { user: unknown }[]) ?? []).map(a => a.user).filter(Boolean),
    extra_departments: ((t.extra_departments as { department: unknown }[]) ?? []).map(a => a.department).filter(Boolean),
    tags: ((t.tags as { tag: unknown }[]) ?? []).map(a => a.tag).filter(Boolean),
  }))

  // Boutiques et services hors Marketing/Web : lecture seule et sans donnée interne (montants, références,
  // description, équipe). Seul ce qui sert à savoir « quand » et « quoi » est exposé.
  if (!isFull) {
    const light = (mapped as unknown as Record<string, unknown>[]).map(t => ({
      id: t.id, title: t.title, status: t.status, priority: t.priority, deadline: t.deadline,
      op_category: t.op_category, op_date_debut: t.op_date_debut, op_date_fin: t.op_date_fin,
      op_mecanique: t.op_mecanique, op_cgv: t.op_cgv, op_exclusions: t.op_exclusions, op_commentaires: t.op_commentaires,
      op_montant: null, op_references: null,
      department: t.department,
    }))
    return NextResponse.json(light, { headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json(mapped, { headers: { 'Cache-Control': 'no-store' } })
}
