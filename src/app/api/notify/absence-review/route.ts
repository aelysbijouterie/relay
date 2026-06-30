import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { baseHtml, button } from '@/emails/baseHtml'

export const dynamic = 'force-dynamic'

// Prévient le demandeur que sa demande a été validée ou refusée.
export async function POST(request: NextRequest) {
  const { absenceId, status } = await request.json()
  const supabase = createAdminClient()

  const { data: absence } = await supabase
    .from('absences')
    .select('type, start_date, end_date, user:profiles!user_id(name, email, department:departments!department_id(color))')
    .eq('id', absenceId).single()
  if (!absence) return NextResponse.json({ sent: 0 })

  const user = Array.isArray(absence.user) ? absence.user[0] : absence.user as { name: string; email: string; department: unknown }
  if (!user?.email) return NextResponse.json({ sent: 0 })

  const dept = Array.isArray(user.department) ? user.department[0] : user.department
  const deptColor = (dept as { color?: string })?.color ?? '#E0596A'
  const validated = status === 'Validé'
  const statusColor = validated ? '#1F9D57' : '#EF4444'
  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const html = baseHtml({
    title: `Demande ${status.toLowerCase()}`,
    preheader: `Ta demande de ${absence.type} a été ${status.toLowerCase()}e`,
    deptColor,
    accentBar: statusColor,
    content: `
      <h2 style="margin:0 0 10px;font-size:21px;font-weight:700;color:#1C1E26;">Demande ${validated ? 'validée' : 'refusée'}</h2>
      <p style="margin:0 0 18px;color:#5A6072;font-size:14.5px;line-height:1.6;">
        Bonjour <strong>${user.name.split(' ')[0]}</strong>,<br/>
        Ta demande d'absence a été <strong style="color:${statusColor}">${status.toLowerCase()}e</strong>.
      </p>
      <div style="background:#F9FAFB;border-left:4px solid ${statusColor};border-radius:0 10px 10px 0;padding:15px 18px;margin-bottom:18px;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#1C1E26;">${absence.type}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#6A7180;">Du ${fmt(absence.start_date)} au ${fmt(absence.end_date)}</p>
      </div>
      ${button({ label: 'Voir mes demandes →', color: deptColor, href: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://aelys-relays.vercel.app'}/conges` })}
    `,
  })
  try {
    await sendEmail({ to: user.email, subject: `${validated ? '✅' : '❌'} Demande d'absence ${status.toLowerCase()}e`, html })
    return NextResponse.json({ sent: 1 })
  } catch { return NextResponse.json({ sent: 0 }) }
}
