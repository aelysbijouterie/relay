import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

const COLUMNS =
  'id, name, email, avatar_url, role, department_id, extra_department_ids, ' +
  'notify_email_assigned, notify_email_status, notify_email_deadlines, notify_email_weekly, notify_email_mentions, ' +
  'show_holidays, show_school_holidays'

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

  return NextResponse.json({ ...row, active_department_id }, { headers: { 'Cache-Control': 'no-store' } })
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
  for (const key of ['notify_email_assigned', 'notify_email_status', 'notify_email_deadlines', 'notify_email_weekly', 'notify_email_mentions', 'show_holidays', 'show_school_holidays'] as const) {
    if (typeof body[key] === 'boolean') updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune modification valide' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select(COLUMNS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}