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

// POST : désactivé. Les nouveaux collaborateurs sont créés par la RH (onglet « Collaborateurs » de
// la gestion des congés boutiques), avec leur date d'entrée et leur contrat, pour que leurs congés soient calculés.
export async function POST() {
  return NextResponse.json({ error: 'Les nouveaux collaborateurs sont ajoutés par la RH' }, { status: 403 })
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
