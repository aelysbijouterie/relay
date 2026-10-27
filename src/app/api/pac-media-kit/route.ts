import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getActingContext } from '@/lib/boutique/session'
import { PAC_MEDIA_KIT_DEPARTMENTS } from '@/types/pacMediaKit'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// GET : toutes les opérations PAC & Média Kit des services Marketing + Web.
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
  // Les boutiques et la RH validatrice des congés voient aussi le planning (en lecture seule).
  const allowed = ctx.isBoutique || profile?.can_validate_boutiques === true
    || PAC_MEDIA_KIT_DEPARTMENTS.includes(mySlug ?? '') || myExtraSlugs.some(s => PAC_MEDIA_KIT_DEPARTMENTS.includes(s))

  if (!allowed) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })

  // Les IDs des services Marketing + Web (indépendamment de qui les demande).
  const { data: pacDepts } = await supabase.from('departments').select('id, slug').in('slug', PAC_MEDIA_KIT_DEPARTMENTS)
  const pacDeptIds = (pacDepts ?? []).map((d: { id: string }) => d.id)
  if (pacDeptIds.length === 0) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })

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
    .in('department_id', pacDeptIds)
    .not('op_category', 'is', null)
    .is('deleted_at', null)
    .neq('status', 'Archivé')

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })

  const mapped = (data ?? []).map((t: Record<string, unknown>) => ({
    ...t,
    assignees: ((t.assignees as { user: unknown }[]) ?? []).map(a => a.user).filter(Boolean),
    extra_departments: ((t.extra_departments as { department: unknown }[]) ?? []).map(a => a.department).filter(Boolean),
    tags: ((t.tags as { tag: unknown }[]) ?? []).map(a => a.tag).filter(Boolean),
  }))

  // Boutiques : lecture seule et sans donnée interne (montants, références,
  // description, équipe). Seul ce qui sert à savoir « quand » et « quoi » est exposé.
  if (ctx.isBoutique) {
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
