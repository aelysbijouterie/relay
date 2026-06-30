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
  const isAdmin   = reviewer.role === 'admin'
  const isManager = reviewer.role === 'manager' && reviewer.department_id === requesterDept
  if (!isAdmin && !isManager) {
    return NextResponse.json({ error: 'Seul un responsable du service peut valider' }, { status: 403 })
  }

  const { error } = await supabase
    .from('absences')
    .update({
      status: newStatus,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_note: body.review_note?.trim() || null,
    })
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
