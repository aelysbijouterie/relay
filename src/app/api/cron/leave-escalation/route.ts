import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendRhRequestMail } from '@/lib/absences/rhMail'

export const dynamic = 'force-dynamic'

const HOUR = 3600000

// Relances à la RH validatrice pour les demandes de congés des boutiques encore en attente :
//  • à 48 h  → « Rappel 48 h »
//  • à 72 h  → « Rappel 72 h — urgent » (une demande déjà vieille de 72 h reçoit directement ce rappel-là)
// Chaque relance n'est envoyée qu'une fois (rh_reminder_48_at / rh_reminder_72_at, migration 030).
// L'attente se compte depuis le dépôt de la demande (created_at) ou, pour une modification, depuis la modification
// (rh_pending_since). Le cron passe plusieurs fois par jour : la relance part au premier passage après le seuil.
// Sans la migration 030, rien n'est envoyé (jamais de relance en double).
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()

  const { data: rows, error } = await supabase
    .from('absences')
    .select('id, created_at, rh_pending_since, rh_reminder_48_at, rh_reminder_72_at, user:profiles!user_id(boutique_id)')
    .in('status', ['En attente', 'Modif. en attente'])
  if (error) return NextResponse.json({ skipped: true, reason: 'migration 030 à exécuter', detail: error.message })

  let r48 = 0, r72 = 0
  const now = Date.now()
  for (const a of rows ?? []) {
    const u = (Array.isArray(a.user) ? a.user[0] : a.user) as { boutique_id?: string | null } | undefined
    if (!u?.boutique_id) continue
    const since = new Date((a.rh_pending_since ?? a.created_at) as string).getTime()
    const age = now - since
    if (age >= 72 * HOUR && !a.rh_reminder_72_at) {
      const stamp = new Date().toISOString()
      // On marque AVANT d'envoyer : en cas de double exécution simultanée, une seule relance part.
      const { error: e } = await supabase.from('absences').update({ rh_reminder_72_at: stamp, rh_reminder_48_at: a.rh_reminder_48_at ?? stamp }).eq('id', a.id).is('rh_reminder_72_at', null)
      if (!e) { await sendRhRequestMail(supabase, a.id as string, 'reminder72'); r72++ }
    } else if (age >= 48 * HOUR && !a.rh_reminder_48_at) {
      const { error: e } = await supabase.from('absences').update({ rh_reminder_48_at: new Date().toISOString() }).eq('id', a.id).is('rh_reminder_48_at', null)
      if (!e) { await sendRhRequestMail(supabase, a.id as string, 'reminder48'); r48++ }
    }
  }
  return NextResponse.json({ reminders48: r48, reminders72: r72 })
}
