import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// PATCH : valider ou refuser une demande.
// Droit : être admin, OU manager du même service que le demandeur.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const newStatus = body.status as 'Validé' | 'Refusé'
  if (newStatus !== 'Validé' && newStatus !== 'Refusé') {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Profil du validateur
  const { data: reviewer } = await supabase
    .from('profiles').select('role, department_id').eq('id', userId).single()
  if (!reviewer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  // L'absence + le service du demandeur
  const { data: absence } = await supabase
    .from('absences')
    .select('id, user_id, user:profiles!user_id(department_id)')
    .eq('id', params.id).single()
  if (!absence) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })

  const requesterDept = Array.isArray(absence.user)
    ? (absence.user[0] as { department_id: string | null })?.department_id
    : (absence.user as { department_id: string | null })?.department_id

  // Contrôle de droits
  // Un responsable (manager OU admin) ne valide que les demandes de SON
  // service — cohérent avec le routage des notifications.
  const canReview = (reviewer.role === 'manager' || reviewer.role === 'admin')
    && reviewer.department_id === requesterDept
  if (!canReview) {
    return NextResponse.json({ error: 'Seul un responsable du service peut valider' }, { status: 403 })
  }

  // Si la demande était une modification en attente et qu'on valide,
  // on applique les dates "pending" ; si on refuse, on les efface.
  const { data: cur } = await supabase
    .from('absences')
    .select('status, pending_start_date, pending_end_date, pending_start_period, pending_end_period')
    .eq('id', params.id).single()

  const updates: Record<string, unknown> = {
    status: newStatus,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
    review_note: body.review_note?.trim() || null,
  }
  if (cur?.status === 'Modif. en attente') {
    if (newStatus === 'Validé' && cur.pending_start_date) {
      updates.start_date   = cur.pending_start_date
      updates.end_date     = cur.pending_end_date
      updates.start_period = cur.pending_start_period ?? 'full'
      updates.end_period   = cur.pending_end_period ?? 'full'
    }
    // Dans tous les cas on nettoie les champs pending.
    updates.pending_start_date = null
    updates.pending_end_date = null
    updates.pending_start_period = null
    updates.pending_end_period = null
    // Un refus de modification laisse l'absence "Validé" (l'ancienne version).
    if (newStatus === 'Refusé') updates.status = 'Validé'
  }

  const { error } = await supabase
    .from('absences')
    .update(updates)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE : annuler sa propre demande (ou admin).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: absence } = await supabase.from('absences').select('user_id').eq('id', params.id).single()
  if (!absence) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (absence.user_id !== userId && me?.role !== 'admin') {
    return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
  }

  const { error } = await supabase.from('absences').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// PUT : demander la modification des dates d'une absence déjà validée.
// L'ancienne version reste affichée ; les nouvelles dates sont stockées en
// "pending" et la demande repasse en "Modif. en attente" (sauf auto-validés).
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { start_date, end_date, start_period, end_period } = await request.json()
  if (!start_date || !end_date) return NextResponse.json({ error: 'Dates requises' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: absence } = await supabase
    .from('absences').select('user_id, status').eq('id', params.id).single()
  if (!absence) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (absence.user_id !== userId) return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })

  // Auto-validés : la modification est appliquée directement.
  const { data: me } = await supabase.from('profiles').select('role').eq('id', userId).single()
  const autoValidated = me?.role === 'manager' || me?.role === 'admin'

  if (autoValidated) {
    const { error } = await supabase.from('absences').update({
      start_date, end_date,
      start_period: start_period ?? 'full', end_period: end_period ?? 'full',
      status: 'Validé', reviewed_by: userId, reviewed_at: new Date().toISOString(),
      pending_start_date: null, pending_end_date: null, pending_start_period: null, pending_end_period: null,
    }).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, autoValidated: true })
  }

  // Sinon : on stocke les nouvelles dates en "pending" et on passe en modif à valider.
  const { error } = await supabase.from('absences').update({
    pending_start_date: start_date, pending_end_date: end_date,
    pending_start_period: start_period ?? 'full', pending_end_period: end_period ?? 'full',
    status: 'Modif. en attente',
  }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, autoValidated: false })
}
