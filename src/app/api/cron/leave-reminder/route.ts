import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { baseHtml, button } from '@/emails/baseHtml'

export const dynamic = 'force-dynamic'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

// Cron des jours ouvrés (08:15) : récapitulatif à la RH des demandes de congés des
// boutiques encore en attente. N'écrit qu'aux personnes ayant can_validate_boutiques
// (jamais aux boutiques) ; aucun mail s'il n'y a rien à traiter.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: rh } = await supabase
    .from('profiles').select('email, name').eq('can_validate_boutiques', true)
  const recipients = (rh ?? []).map(p => p.email as string).filter(Boolean)
  if (recipients.length === 0) return NextResponse.json({ sent: 0 })

  const { data: rows } = await supabase
    .from('absences')
    .select(`
      id, type, start_date, end_date, status, created_at,
      user:profiles!user_id(name, boutique_id, boutique:boutiques!boutique_id(name))
    `)
    .in('status', ['En attente', 'Modif. en attente'])
    .order('start_date', { ascending: true })

  type Row = { type: string; start_date: string; end_date: string; status: string; created_at: string; who: string; shop: string }
  const pending: Row[] = (rows ?? []).flatMap((a: Record<string, unknown>) => {
    const user = (Array.isArray(a.user) ? a.user[0] : a.user) as { name?: string; boutique_id?: string | null; boutique?: { name?: string } | { name?: string }[] | null } | undefined
    if (!user?.boutique_id) return []
    const shop = Array.isArray(user.boutique) ? user.boutique[0] : user.boutique
    return [{
      type: a.type as string, start_date: a.start_date as string, end_date: a.end_date as string,
      status: a.status as string, created_at: a.created_at as string,
      who: user.name ?? '?', shop: shop?.name ?? '',
    }]
  })
  if (pending.length === 0) return NextResponse.json({ sent: 0 })

  const oldest = pending.reduce((min, r) => (r.created_at < min ? r.created_at : min), pending[0].created_at)
  const waitingDays = Math.floor((Date.now() - new Date(oldest).getTime()) / 86400000)
  const color = '#3E8FCC' // RH
  const list = pending.slice(0, 12).map(r =>
    `<li style="margin:0 0 6px;">${escapeHtml(r.who)} <span style="color:#6A7180;">(${escapeHtml(r.shop)})</span> — ${escapeHtml(r.type)}, ${fmt(r.start_date)}${r.end_date !== r.start_date ? ` → ${fmt(r.end_date)}` : ''}${r.status === 'Modif. en attente' ? ' <em>(modification)</em>' : ''}</li>`
  ).join('')

  const html = baseHtml({
    title: 'Demandes de congés à traiter',
    preheader: `${pending.length} demande${pending.length > 1 ? 's' : ''} de boutiques en attente`,
    deptColor: color,
    content: `
      <h2 style="margin:0 0 10px;font-size:21px;font-weight:700;color:#1C1E26;">${pending.length} demande${pending.length > 1 ? 's' : ''} de congés à traiter</h2>
      <p style="margin:0 0 14px;color:#5A6072;font-size:14.5px;line-height:1.6;">
        Demandes des boutiques en attente de validation${waitingDays >= 2 ? ` (la plus ancienne date de ${waitingDays} jours)` : ''} :
      </p>
      <ul style="margin:0 0 18px;padding-left:18px;color:#1C1E26;font-size:14px;line-height:1.5;">${list}</ul>
      ${pending.length > 12 ? `<p style="margin:0 0 18px;color:#6A7180;font-size:13px;">… et ${pending.length - 12} autre(s).</p>` : ''}
      ${button({ label: 'Ouvrir la gestion RH →', color, href: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://aelys-relays.vercel.app'}/conges/rh` })}
    `,
  })

  await sendEmail({ to: recipients, subject: `🗓️ ${pending.length} demande${pending.length > 1 ? 's' : ''} de congés des boutiques à traiter`, html })
  return NextResponse.json({ sent: recipients.length, pending: pending.length })
}
