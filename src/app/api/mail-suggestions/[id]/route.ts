import { NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { createAdminClient } from '@/lib/supabase/server'
import { createCardFromAction, getMailOwner } from '@/lib/mail/pipeline'

export const dynamic = 'force-dynamic'

const PRIORITIES = ['Urgent', 'Élevée', 'Moyenne', 'Faible']

// { action: 'create', title?, description?, priority?, deadline? } crée la carte ; { action: 'dismiss' } ignore la proposition.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const userId = readSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const supabase = createAdminClient()
  const owner = await getMailOwner(supabase)
  if (!owner || owner.id !== userId) return NextResponse.json({ error: 'Accès réservé' }, { status: 403 })

  const { data: s } = await supabase.from('mail_suggestions').select('*').eq('id', params.id).eq('owner_id', owner.id).single()
  if (!s) return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 })
  if (s.status !== 'pending') return NextResponse.json({ error: 'Déjà traitée' }, { status: 409 })

  const body = await request.json().catch(() => ({}))
  if (body?.action === 'dismiss') {
    await supabase.from('mail_suggestions').update({ status: 'dismissed' }).eq('id', s.id)
    return NextResponse.json({ success: true })
  }
  if (body?.action !== 'create') return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })

  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : s.title
  const description = typeof body.description === 'string' ? body.description : s.description
  const priority = PRIORITIES.includes(body.priority) ? body.priority : s.priority ?? 'Moyenne'
  const deadline = typeof body.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.deadline) ? body.deadline : body.deadline === '' ? null : s.deadline
  const taskId = await createCardFromAction(supabase, owner, {
    title, description, priority, deadline,
    from: s.from_name ? `${s.from_name} <${s.from_email}>` : s.from_email ?? '', subject: s.subject ?? '', received: s.received_at,
  })
  if (!taskId) return NextResponse.json({ error: 'Création de la carte impossible' }, { status: 500 })
  await supabase.from('mail_suggestions').update({ status: 'created', task_id: taskId, title, description, priority, deadline }).eq('id', s.id)
  return NextResponse.json({ success: true, taskId })
}
