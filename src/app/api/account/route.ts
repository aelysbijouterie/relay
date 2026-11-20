import { NextRequest, NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getActingContext } from '@/lib/boutique/session'
import { HOME_COOKIE, HOME_VIEWS, sanitizeHome } from '@/lib/home-view'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  return readSessionUserId()
}

const COLUMNS =
  'id, name, email, avatar_url, role, department_id, extra_department_ids, conges_default_dept_ids, ' +
  'notify_email_assigned, notify_email_status, notify_email_deadlines, notify_email_weekly, notify_email_mentions, ' +
  'show_holidays, show_school_holidays, show_absences_calendar, ' +
  'is_boutique_account, boutique_id, can_validate_boutiques'

export async function GET() {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .eq('id', userId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Service actuellement actif (celui choisi via le switch de la sidebar).
  // On valide le cookie contre les services autorisés de l'utilisateur, sinon
  // on retombe sur le service principal.
  const row = data as unknown as Record<string, unknown>
  const allowed = [row?.department_id, ...((row?.extra_department_ids as string[] | null) ?? [])].filter(Boolean) as string[]
  const cookieDept = cookies().get('relays-active-dept')?.value
  const active_department_id = cookieDept && allowed.includes(cookieDept) ? cookieDept : (row?.department_id as string | null) ?? null

  // Compte de boutique : collaborateur actif (celui au nom duquel on pose les congés).
  const ctx = await getActingContext(supabase, userId)
  const acting_member_id: string | null = ctx.isBoutique ? ctx.actingUserId : null
  let acting_is_cadre = false
  if (acting_member_id) {
    const { data: m } = await supabase.from('profiles').select('is_cadre').eq('id', acting_member_id).single()
    acting_is_cadre = m?.is_cadre === true
  }

  // Vue favorite : colonne facultative (migration 033), lue à part pour ne jamais faire échouer le profil.
  const { data: dv } = await supabase.from('profiles').select('default_view').eq('id', userId).single()
  const default_view = sanitizeHome((dv as { default_view?: string | null } | null)?.default_view ?? cookies().get(HOME_COOKIE)?.value)

  return NextResponse.json({ ...row, active_department_id, acting_member_id, acting_is_cadre, default_view }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()

  // On n'autorise QUE ces champs : un utilisateur ne peut pas modifier son
  // rôle, son département ou son email via cette route (ce serait une faille
  // d'élévation de privilèges). Le rôle/département se gèrent côté managers.
  const updates: Record<string, unknown> = {}

  if (typeof body.name === 'string' && body.name.trim().length > 0) {
    updates.name = body.name.trim()
  }
  for (const key of ['notify_email_assigned', 'notify_email_status', 'notify_email_deadlines', 'notify_email_weekly', 'notify_email_mentions', 'show_holidays', 'show_school_holidays', 'show_absences_calendar'] as const) {
    if (typeof body[key] === 'boolean') updates[key] = body[key]
  }

  // Services affichés par défaut dans le tableau des congés (liste d'UUID).
  if (Array.isArray(body.conges_default_dept_ids)) {
    const ids = body.conges_default_dept_ids.filter((x: unknown) => typeof x === 'string')
    updates.conges_default_dept_ids = ids.length > 0 ? ids : null
  }

  const supabase = createAdminClient()

  // Vue favorite : enregistrée dans le profil si la colonne existe, et TOUJOURS dans le cookie du navigateur.
  if (typeof body.default_view === 'string' && HOME_VIEWS.some(h => h.href === body.default_view)) {
    await supabase.from('profiles').update({ default_view: body.default_view }).eq('id', userId)
    const res = NextResponse.json({ success: true, default_view: body.default_view })
    res.cookies.set(HOME_COOKIE, body.default_view, { secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 })
    return res
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune modification valide' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select(COLUMNS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}