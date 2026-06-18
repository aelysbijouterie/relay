import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyByPreference } from '@/lib/notify'
import { emailAssigned, emailCrossTeam } from '@/emails/templates'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Notifie les personnes assignées à une tâche, SAUF la personne qui a fait
// l'assignation (pas d'auto-notification si on s'assigne soi-même), et
// seulement celles qui ont activé notify_email_assigned.
export async function POST(request: NextRequest) {
  const { assignees, task, department, createdByName, fromDept } = await request.json()
  if (!assignees?.length) return NextResponse.json({ sent: 0 })

  const actorId = getUserId()
  let actorEmail: string | undefined
  if (actorId) {
    const supabase = createAdminClient()
    const { data } = await supabase.from('profiles').select('email').eq('id', actorId).single()
    actorEmail = data?.email
  }

  let sent = 0
  for (const a of assignees as { name: string; email: string }[]) {
    const tpl = task.is_cross_team && fromDept
      ? emailCrossTeam({ assigneeName: a.name.split(' ')[0], createdByName, task, fromDept, toDept: department })
      : emailAssigned({ assigneeName: a.name.split(' ')[0], createdByName, task, department })

    sent += await notifyByPreference({
      emails: [a.email],
      pref: 'notify_email_assigned',
      subject: tpl.subject,
      html: tpl.html,
      exclude: actorEmail ? [actorEmail] : [],
    })
  }

  return NextResponse.json({ sent })
}