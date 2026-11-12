import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { sendEmail } from '@/lib/email'
import { baseHtml, button } from '@/emails/baseHtml'

export const dynamic = 'force-dynamic'

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Prévient le demandeur que sa demande a été validée ou refusée.
// Sécurité : réservé à la personne qui vient de rendre la décision ; le statut vient de la base (jamais du navigateur).
export async function POST(request: NextRequest) {
  const userId = readSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { absenceId, status: claimed } = await request.json().catch(() => ({}))
  if (typeof absenceId !== 'string') return NextResponse.json({ sent: 0 })
  const supabase = createAdminClient()

  const { data: absence } = await supabase
    .from('absences')
    .select('type, start_date, end_date, status, review_note, reviewed_by, reviewed_at, user:profiles!user_id(name, email, boutique_id, department:departments!department_id(color))')
    .eq('id', absenceId).single()
  if (!absence) return NextResponse.json({ sent: 0 })

  // Seul le décideur peut déclencher l'e-mail, dans les minutes qui suivent sa décision.
  const recent = absence.reviewed_at && Date.now() - new Date(absence.reviewed_at as string).getTime() < 10 * 60 * 1000
  if (absence.reviewed_by !== userId || !recent) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  // Statut réel : « Refusé » en base = demande refusée ; « Validé » en base = validée, sauf si la décision refusait
  // une MODIFICATION (l'absence reste alors « Validé » avec ses anciennes dates).
  const modificationRefused = absence.status === 'Validé' && claimed === 'Refusé'
  if (absence.status !== 'Validé' && absence.status !== 'Refusé') return NextResponse.json({ sent: 0 })
  const refused = absence.status === 'Refusé' || modificationRefused

  const user = (Array.isArray(absence.user) ? absence.user[0] : absence.user) as
    { name: string; email: string; boutique_id: string | null; department: unknown }
  if (!user?.email) return NextResponse.json({ sent: 0 })

  // Collaborateur de boutique : adresse technique (.invalid) → on écrit à la boutique.
  let recipient = user.email
  if (user.email.endsWith('.invalid') && user.boutique_id) {
    const { data: shop } = await supabase
      .from('profiles').select('email').eq('boutique_id', user.boutique_id).eq('is_boutique_account', true).single()
    if (!shop?.email) return NextResponse.json({ sent: 0 })
    recipient = shop.email
  }
  const formal = !!user.boutique_id // les magasins sont vouvoyés

  const dept = Array.isArray(user.department) ? user.department[0] : user.department
  const deptColor = (dept as { color?: string })?.color ?? '#E0596A'
  const statusColor = refused ? '#EF4444' : '#1F9D57'
  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const what = modificationRefused ? 'La modification de dates' : (formal ? 'Votre demande' : 'Ta demande') + ' d\'absence'
  const verdict = refused ? 'refusée' : 'validée'
  const first = esc(user.name.split(' ')[0])
  const who = formal ? `${first}` : first

  const html = baseHtml({
    title: `Demande ${verdict}`,
    preheader: `${modificationRefused ? 'La modification' : formal ? 'Votre demande' : 'Ta demande'} de ${absence.type} a été ${verdict}`,
    deptColor,
    accentBar: statusColor,
    content: `
      <h2 style="margin:0 0 10px;font-size:21px;font-weight:700;color:#1C1E26;">${modificationRefused ? 'Modification refusée' : refused ? 'Demande refusée' : 'Demande validée'}</h2>
      <p style="margin:0 0 18px;color:#5A6072;font-size:14.5px;line-height:1.6;">
        Bonjour <strong>${who}</strong>,<br/>
        ${esc(what)} a été <strong style="color:${statusColor}">${verdict}</strong>${modificationRefused ? ' ; les dates initiales sont conservées' : ''}.
      </p>
      <div style="background:#F9FAFB;border-left:4px solid ${statusColor};border-radius:0 10px 10px 0;padding:15px 18px;margin-bottom:18px;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#1C1E26;">${esc(absence.type)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#6A7180;">Du ${fmt(absence.start_date as string)} au ${fmt(absence.end_date as string)}</p>
      </div>
      ${refused && absence.review_note ? `<div style="background:#FEF2F2;border-radius:10px;padding:13px 16px;margin-bottom:18px;"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#B91C1C;text-transform:uppercase;letter-spacing:.04em;">Motif</p><p style="margin:0;font-size:14px;color:#1C1E26;white-space:pre-wrap;">${esc(absence.review_note)}</p></div>` : ''}
      ${button({ label: formal ? 'Voir mes demandes →' : 'Voir mes demandes →', color: deptColor, href: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://aelys-relays.vercel.app'}/conges` })}
    `,
  })
  try {
    await sendEmail({ to: recipient, subject: `${refused ? '❌' : '✅'} ${modificationRefused ? 'Modification refusée' : `Demande d'absence ${verdict}`}`, html })
    return NextResponse.json({ sent: 1 })
  } catch { return NextResponse.json({ sent: 0 }) }
}
