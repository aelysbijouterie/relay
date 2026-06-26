import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

// Clés de préférence telles que stockées dans profiles (migration 005).
export type NotifPref =
  | 'notify_email_assigned'
  | 'notify_email_status'
  | 'notify_email_deadlines'
  | 'notify_email_weekly'
  | 'notify_email_mentions'

interface NotifyInput {
  /** Emails des destinataires visés. */
  emails: string[]
  /** Préférence à respecter : seuls ceux qui l'ont activée recevront le mail. */
  pref: NotifPref
  subject: string
  html: string
  /** Emails à exclure explicitement (ex : l'auteur de l'action). */
  exclude?: string[]
}

/**
 * Envoi de notification RESPECTANT les préférences de chaque destinataire.
 *
 * C'est LE point de passage obligatoire pour toute notification liée à une
 * préférence. On lit en base, pour chaque destinataire, la colonne de
 * préférence correspondante : par défaut true (migration 005), donc une
 * personne reçoit tout tant qu'elle n'a rien décoché dans "Mon compte".
 * Si elle a décoché, on ne lui envoie pas ce type de mail.
 */
export async function notifyByPreference(input: NotifyInput): Promise<number> {
  const exclude = new Set((input.exclude ?? []).map(e => e.toLowerCase()))
  const targets = [...new Set(input.emails.map(e => e.trim()).filter(Boolean))]
    .filter(e => !exclude.has(e.toLowerCase()))

  if (targets.length === 0) return 0

  const supabase = createAdminClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select(`email, ${input.pref}`)
    .in('email', targets)

  // On n'envoie qu'aux personnes dont la préférence est active (true).
  // Si un email n'a pas de profil correspondant, on s'abstient par prudence.
  const allowed = (profiles ?? [])
    .filter((p: Record<string, unknown>) => p[input.pref] !== false)
    .map((p: Record<string, unknown>) => p.email as string)

  let sent = 0
  for (const email of allowed) {
    await sendEmail({ to: email, subject: input.subject, html: input.html })
    sent++
  }
  return sent
}