import { NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getActingContext } from '@/lib/boutique/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createAdminClient()

  // Une boutique ne voit que son propre compte : jamais le reste de l'entreprise.
  let sessionUserId: string | null = null
  sessionUserId = readSessionUserId()
  if (!sessionUserId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const ctx = sessionUserId ? await getActingContext(supabase, sessionUserId) : null

  // Boutique : uniquement les collaborateurs de SON magasin (pour les identifier sur les cartes et sous-tâches).
  if (ctx?.isBoutique && ctx.boutiqueId) {
    const { data: members } = await supabase
      .from('profiles').select('id, name, email, avatar_url, role, department_id')
      .eq('boutique_id', ctx.boutiqueId).eq('is_boutique_account', false).order('name')
    const group = { id: 'boutique-team', name: 'Collaborateurs du magasin', color: '#0E7C86', slug: 'boutiques' }
    return NextResponse.json((members ?? []).map(m => ({ ...m, department: group })))
  }

  // Équipes du siège : jamais de boutique (compte ou collaborateur) dans les personnes assignables.
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, role, department_id, department:departments(id, name, color, slug)')
    .eq('is_active', true)
    .is('boutique_id', null)
    .order('name')

  if (error) {
    console.error('Profiles error:', error.message)
    return NextResponse.json([])
  }
  return NextResponse.json(data ?? [])
}
