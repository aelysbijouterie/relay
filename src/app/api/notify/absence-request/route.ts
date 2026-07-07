import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { baseHtml, button } from '@/emails/baseHtml'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Prévient les responsables (manager/admin) du service du demandeur qu'une
// nouvelle demande d'absence est à valider.
export async function POST(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ sent: 0 })
  const { type, start_date, end_date } = await request.json()

  const supabase = createAdminClient()
  const { data: requester } = await supabase
    .from('profiles').select('name, department_id, department:departments!department_id(name, color)').eq('id', userId).single()
  if (!requester) return NextResponse.json({ sent: 0 })

  // Responsables (manager/admin) du SERVICE du demandeur : soit ce service est
  // leur service principal, soit il fait partie de leurs services additionnels
  // (extra_department_ids). Cela couvre les responsables de plusieurs services
  // (ex : Audrey pour RH + Administratif). Jamais le demandeur lui-même.
  const { data: allManagers } = await supabase
    .from('profiles').select('id, name, email, role, department_id, extra_department_ids')
    .in('role', ['manager', 'admin'])
    .neq('id', userId)

  const managers = (allManagers ?? []).filter(m => {
    if (m.department_id === requester.department_id) return true
    const extras: string[] = m.extra_department_ids ?? []
    return extras.includes(requester.department_id as string)
  })

  const dept = Array.isArray(requester.department) ? requester.department[0] : requester.department
  const deptColor = (dept as { color?: string })?.color ?? '#E0596A'
  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  let sent = 0
  for (const m of managers ?? []) {
    if (!m.email) continue
    const html = baseHtml({
      title: 'Nouvelle demande d\'absence',
      preheader: `${requester.name} a déposé une demande de ${type}`,
      deptColor,
      content: `
        <h2 style="margin:0 0 10px;font-size:21px;font-weight:700;color:#1C1E26;">Demande d'absence à valider</h2>
        <p style="margin:0 0 18px;color:#5A6072;font-size:14.5px;line-height:1.6;">
          <strong>${requester.name}</strong> a déposé une demande d'absence :
        </p>
        <div style="background:#F9FAFB;border-left:4px solid ${deptColor};border-radius:0 10px 10px 0;padding:15px 18px;margin-bottom:18px;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#1C1E26;">${type}</p>
          <p style="margin:6px 0 0;font-size:13px;color:#6A7180;">Du ${fmt(start_date)} au ${fmt(end_date)}</p>
        </div>
        ${button({ label: 'Voir la demande →', color: deptColor, href: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://aelys-relays.vercel.app'}/conges` })}
      `,
    })
    try {
      await sendEmail({ to: m.email, subject: `🗓️ Demande d'absence — ${requester.name}`, html })
      sent++
    } catch { /* noop */ }
  }
  return NextResponse.json({ sent })
}
