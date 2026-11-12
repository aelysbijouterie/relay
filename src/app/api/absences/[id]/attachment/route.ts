import { NextRequest, NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getActingContext } from '@/lib/boutique/session'
import { sendRhRequestMail } from '@/lib/absences/rhMail'

export const dynamic = 'force-dynamic'

const BUCKET = 'absence-docs'
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

function getUserId(): string | null {
  return readSessionUserId()
}

// POST (multipart, champ « file ») : joint un justificatif (arrêt maladie) à une absence signalée par une boutique.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const supabase = createAdminClient()
  const ctx = await getActingContext(supabase, userId)
  if (!ctx.isBoutique || !ctx.boutiqueId) return NextResponse.json({ error: 'Réservé aux boutiques' }, { status: 403 })

  const { data: absence } = await supabase
    .from('absences').select('id, user_id, type, user:profiles!user_id(boutique_id)').eq('id', params.id).single()
  const owner = Array.isArray(absence?.user) ? absence?.user[0] : absence?.user
  if (!absence || (owner as { boutique_id?: string | null } | undefined)?.boutique_id !== ctx.boutiqueId) {
    return NextResponse.json({ error: 'Absence introuvable' }, { status: 404 })
  }
  if (absence.type !== 'Maladie' && absence.type !== 'Autre') {
    return NextResponse.json({ error: 'Pièce jointe réservée aux absences signalées' }, { status: 400 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Fichier trop lourd (10 Mo maximum)' }, { status: 413 })
  if (file.type && !ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Format accepté : PDF ou image (JPG, PNG)' }, { status: 415 })

  await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {})
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  const path = `${params.id}/${Date.now()}-${safe}`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { error } = await supabase.from('absences').update({ attachment_path: path, attachment_name: file.name }).eq('id', params.id)
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    return NextResponse.json({ error: 'Pièce jointe non enregistrée (migration 029 à exécuter ?) : ' + error.message }, { status: 500 })
  }
  // Le mail d'information à la RH part maintenant, avec le justificatif.
  await sendRhRequestMail(supabase, params.id, 'info')
  return NextResponse.json({ success: true, name: file.name })
}

// GET : ouvre le justificatif (lien signé de 60 s). Réservé à la RH validatrice et à la boutique concernée.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const supabase = createAdminClient()

  const { data: absence } = await supabase
    .from('absences').select('attachment_path, user:profiles!user_id(boutique_id)').eq('id', params.id).single()
  if (!absence?.attachment_path) return NextResponse.json({ error: 'Aucune pièce jointe' }, { status: 404 })

  const { data: me } = await supabase.from('profiles').select('can_validate_boutiques, is_boutique_account, boutique_id').eq('id', userId).single()
  const owner = Array.isArray(absence.user) ? absence.user[0] : absence.user
  const sameShop = me?.is_boutique_account && me.boutique_id && me.boutique_id === (owner as { boutique_id?: string | null } | undefined)?.boutique_id
  if (!me?.can_validate_boutiques && !sameShop) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(absence.attachment_path as string, 60)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Fichier indisponible' }, { status: 404 })
  return NextResponse.redirect(data.signedUrl)
}
