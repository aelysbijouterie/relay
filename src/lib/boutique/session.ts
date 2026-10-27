import { cookies } from 'next/headers'
import type { createAdminClient } from '@/lib/supabase/server'

type Admin = ReturnType<typeof createAdminClient>

export const BOUTIQUE_COOKIE = 'relays-boutique' // posé au login : id de la boutique
export const MEMBER_COOKIE   = 'relays-member'   // collaborateur choisi dans la boutique

export interface ActingContext {
  /** Utilisateur réellement connecté (compte de la boutique ou personne du siège). */
  sessionUserId: string
  isBoutique: boolean
  boutiqueId: string | null
  /** Qui agit : le collaborateur choisi (boutique) ou l'utilisateur lui-même. null = boutique sans collaborateur choisi. */
  actingUserId: string | null
}

/**
 * Pour un compte de boutique, détermine le collaborateur « actif » (cookie
 * relays-member, vérifié contre la boutique). Pour tout autre utilisateur,
 * l'acteur est l'utilisateur connecté. Tolérant : si les colonnes boutiques
 * n'existent pas encore en base, tout le monde est traité comme non-boutique.
 */
export async function getActingContext(supabase: Admin, sessionUserId: string): Promise<ActingContext> {
  const { data: me } = await supabase
    .from('profiles').select('is_boutique_account, boutique_id').eq('id', sessionUserId).single()

  if (!me?.is_boutique_account || !me.boutique_id) {
    return { sessionUserId, isBoutique: false, boutiqueId: null, actingUserId: sessionUserId }
  }

  let actingUserId: string | null = null
  const memberId = cookies().get(MEMBER_COOKIE)?.value
  if (memberId) {
    const { data: m } = await supabase
      .from('profiles').select('id')
      .eq('id', memberId).eq('boutique_id', me.boutique_id).eq('is_boutique_account', false).single()
    actingUserId = m?.id ?? null
  }
  return { sessionUserId, isBoutique: true, boutiqueId: me.boutique_id as string, actingUserId }
}
