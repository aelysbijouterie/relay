import type { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { baseHtml, button } from '@/emails/baseHtml'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Prévient la RH validatrice qu'une boutique a ANNULÉ une demande déjà validée (ou en cours de modification).
 * Une demande simplement « en attente » qui disparaît n'a pas besoin de mail : elle quitte la liste de la RH.
 * Ne bloque jamais la suppression.
 */
export async function notifyRhCancellation(supabase: ReturnType<typeof createAdminClient>, absence: {
  userId: string; type: string; start_date: string; end_date: string; status: string
}): Promise<void> {
  if (absence.status !== 'Validé' && absence.status !== 'Modif. en attente') return
  try {
    const [{ data: who }, { data: rh }] = await Promise.all([
      supabase.from('profiles').select('name, boutique:boutiques!boutique_id(name)').eq('id', absence.userId).single(),
      supabase.from('profiles').select('email').eq('can_validate_boutiques', true),
    ])
    const recipients = (rh ?? []).map(p => p.email as string).filter(Boolean)
    if (recipients.length === 0) return
    const shopRel = Array.isArray(who?.boutique) ? who?.boutique[0] : who?.boutique
    const label = `${who?.name ?? 'Un collaborateur'}${(shopRel as { name?: string } | undefined)?.name ? ` (${(shopRel as { name?: string }).name})` : ''}`
    const color = '#3E8FCC'
    const html = baseHtml({
      title: 'Demande annulée',
      preheader: `${label} a annulé une demande de ${absence.type}`,
      deptColor: color,
      content: `
        <h2 style="margin:0 0 10px;font-size:21px;font-weight:700;color:#1C1E26;">Demande annulée</h2>
        <p style="margin:0 0 18px;color:#5A6072;font-size:14.5px;line-height:1.6;"><strong>${esc(label)}</strong> a annulé une demande déjà ${absence.status === 'Validé' ? 'validée' : 'en cours de modification'} :</p>
        <div style="background:#F9FAFB;border-left:4px solid #EF4444;border-radius:0 10px 10px 0;padding:15px 18px;margin-bottom:18px;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#1C1E26;">${esc(absence.type)}</p>
          <p style="margin:6px 0 0;font-size:13px;color:#6A7180;">Du ${fmt(absence.start_date)} au ${fmt(absence.end_date)}</p>
        </div>
        ${button({ label: 'Ouvrir la gestion des congés →', color, href: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://aelys-relays.vercel.app'}/conges/rh` })}
      `,
    })
    await sendEmail({ to: recipients, subject: `↩️ Congé annulé — ${label}`, html })
  } catch { /* information seulement */ }
}
