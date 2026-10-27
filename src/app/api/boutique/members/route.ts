import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getActingContext, MEMBER_COOKIE } from '@/lib/boutique/session'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// GET : collaborateurs de la boutique connectée + collaborateur actif.
export async function GET() {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const supabase = createAdminClient()
  const ctx = await getActingContext(supabase, userId)
  if (!ctx.isBoutique || !ctx.boutiqueId) return NextResponse.json({ isBoutique: false })

  const [{ data: boutique }, { data: members }] = await Promise.all([
    supabase.from('boutiques').select('id, name').eq('id', ctx.boutiqueId).single(),
    supabase.from('profiles').select('id, name')
      .eq('boutique_id', ctx.boutiqueId).eq('is_boutique_account', false).order('name'),
  ])
  return NextResponse.json(
    { isBoutique: true, boutique, members: members ?? [], current: ctx.actingUserId },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// POST { name } : ajoute un collaborateur à la boutique (profil sans connexion).
export async function POST(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const supabase = createAdminClient()
  const ctx = await getActingContext(supabase, userId)
  if (!ctx.isBoutique || !ctx.boutiqueId) return NextResponse.json({ error: 'Réservé aux boutiques' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json({ error: 'Nom invalide (2 à 60 caractères)' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('profiles').select('id').eq('boutique_id', ctx.boutiqueId).ilike('name', name)
  if ((existing ?? []).length > 0) return NextResponse.json({ error: 'Ce collaborateur existe déjà' }, { status: 409 })

  const { data: dept } = await supabase.from('departments').select('id').eq('slug', 'boutiques').single()
  if (!dept) return NextResponse.json({ error: 'Service Boutiques introuvable' }, { status: 500 })

  // profiles.id référence auth.users : on crée un utilisateur technique, sans
  // adresse réelle et avec un mot de passe aléatoire que personne ne connaît
  // (le collaborateur ne se connecte jamais, il est choisi dans la boutique).
  const slug = crypto.randomUUID().slice(0, 8)
  const email = `membre-${slug}@boutiques.aelys.invalid`
  const { data: created, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    email_confirm: true,
    user_metadata: { name },
  })
  if (authErr || !created.user) return NextResponse.json({ error: authErr?.message ?? 'Création impossible' }, { status: 500 })

  const { error: profErr } = await supabase.from('profiles').upsert({
    id: created.user.id,
    name,
    email,
    department_id: dept.id,
    role: 'collaborateur',
    is_active: false, // jamais proposé dans les listes d'assignation du siège
    boutique_id: ctx.boutiqueId,
    is_boutique_account: false,
    notify_email_assigned: false, notify_email_status: false, notify_email_deadlines: false,
    notify_email_weekly: false, notify_email_mentions: false,
  })
  if (profErr) {
    await supabase.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, id: created.user.id, name })
}

// PUT { member_id | null } : choisit le collaborateur actif (cookie de session).
export async function PUT(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const supabase = createAdminClient()
  const ctx = await getActingContext(supabase, userId)
  if (!ctx.isBoutique || !ctx.boutiqueId) return NextResponse.json({ error: 'Réservé aux boutiques' }, { status: 403 })

  const { member_id } = await request.json().catch(() => ({ member_id: null }))
  const response = NextResponse.json({ success: true })
  if (!member_id) { response.cookies.delete(MEMBER_COOKIE); return response }

  const { data: m } = await supabase
    .from('profiles').select('id')
    .eq('id', member_id).eq('boutique_id', ctx.boutiqueId).eq('is_boutique_account', false).single()
  if (!m) return NextResponse.json({ error: 'Collaborateur inconnu' }, { status: 404 })

  // Cookie de session (sans maxAge) : sur un poste partagé, on re-choisit à chaque ouverture.
  response.cookies.set(MEMBER_COOKIE, m.id, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
  return response
}
