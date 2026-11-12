import { NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getActingContext } from '@/lib/boutique/session'
import { sendRhRequestMail } from '@/lib/absences/rhMail'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  return readSessionUserId()
}

// POST : envoie à la RH l'e-mail d'information d'une absence signalée dont le justificatif n'a pas pu être enregistré
// (sans cela, le mail n'aurait pas été envoyé : il attendait le fichier). Réservé à la boutique propriétaire.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const supabase = createAdminClient()
  const ctx = await getActingContext(supabase, userId)
  if (!ctx.isBoutique || !ctx.boutiqueId) return NextResponse.json({ error: 'Réservé aux boutiques' }, { status: 403 })

  const { data: absence } = await supabase
    .from('absences').select('type, created_at, user:profiles!user_id(boutique_id)').eq('id', params.id).single()
  const owner = Array.isArray(absence?.user) ? absence?.user[0] : absence?.user
  if (!absence || (owner as { boutique_id?: string | null } | undefined)?.boutique_id !== ctx.boutiqueId) {
    return NextResponse.json({ error: 'Absence introuvable' }, { status: 404 })
  }
  if (absence.type !== 'Maladie' && absence.type !== 'Autre') return NextResponse.json({ error: 'Type non concerné' }, { status: 400 })
  // Anti-abus : uniquement juste après la création de l'absence.
  if (Date.now() - new Date(absence.created_at as string).getTime() > 10 * 60 * 1000) return NextResponse.json({ error: 'Délai dépassé' }, { status: 400 })

  const sent = await sendRhRequestMail(supabase, params.id, 'info')
  return NextResponse.json({ sent })
}
