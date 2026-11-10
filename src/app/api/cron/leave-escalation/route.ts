import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendRhRequestMail } from '@/lib/absences/rhMail'

export const dynamic = 'force-dynamic'

const HOUR = 3600000

// Relance à la RH validatrice pour les demandes de congés des boutiques encore en attente après 72 h :
// « Rappel 72 h — urgent ». Envoyée une seule fois par demande (rh_reminder_72_at, migration 030).
// L'attente se compte depuis le dépôt de la demande (created_at) ou, pour une modification, depuis la modification
// (rh_pending_since). Le cron passe plusieurs fois par jour : la relance part au premier passage après le seuil.
// Sans la migration 030, rien n'est envoyé (jamais de relance en double).
// Le circuit complet : e-mail immédiat à la demande, relance à 72 h, récapitulatif du lundi 09 h (cron/leave-reminder).
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()

  const { data: rows, error } = await supabase
    .from('absences')
    .select('id, created_at, rh_pending_since, rh_reminder_72_at, user:profiles!user_id(boutique_id)')
    .in('status', ['En attente', 'Modif. en attente'])
  if (error) return NextResponse.json({ skipped: true, reason: 'migration 030 à exécuter', detail: error.message })

  let sent = 0
  const now = Date.now()
  for (const a of rows ?? []) {
    const u = (Array.isArray(a.user) ? a.user[0] : a.user) as { boutique_id?: string | null } | undefined
    if (!u?.boutique_id || a.rh_reminder_72_at) continue
    const since = new Date((a.rh_pending_since ?? a.created_at) as string).getTime()
    if (now - since < 72 * HOUR) continue
    // On marque AVANT d'envoyer : en cas de double exécution simultanée, une seule relance part.
    const { error: e } = await supabase.from('absences').update({ rh_reminder_72_at: new Date().toISOString() }).eq('id', a.id).is('rh_reminder_72_at', null)
    if (!e) { await sendRhRequestMail(supabase, a.id as string, 'reminder72'); sent++ }
  }
  return NextResponse.json({ reminders72: sent })
}
