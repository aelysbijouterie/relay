import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyByPreference } from '@/lib/notify'
import { emailSubtaskAssigned } from '@/emails/templates'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Notifie une personne assignée à une sous-tâche (respecte la préférence
// « Tâche assignée », et n'envoie pas à l'auteur de l'action).
export async function POST(request: NextRequest) {
  const { assignee, subtaskTitle, deadline, task, department, createdByName } = await request.json()
  if (!assignee?.email) return NextResponse.json({ sent: 0 })

  const supabase = createAdminClient()

  // Couleur de l'espace (le front n'envoie que le nom).
  let deptInfo = { name: department ?? '', color: '#E0596A' }
  if (department) {
    const { data } = await supabase.from('departments').select('name, color').eq('name', department).single()
    if (data) deptInfo = data
  }

  // Email de l'auteur (à exclure).
  const actorId = getUserId()
  let actorEmail: string | undefined
  if (actorId) {
    const { data } = await supabase.from('profiles').select('email').eq('id', actorId).single()
    actorEmail = data?.email
  }

  const tpl = emailSubtaskAssigned({
    assigneeName: assignee.name.split(' ')[0],
    createdByName,
    subtaskTitle,
    task,
    department: deptInfo,
    deadline,
  })

  const sent = await notifyByPreference({
    emails: [assignee.email],
    pref: 'notify_email_assigned',
    subject: tpl.subject,
    html: tpl.html,
    exclude: actorEmail ? [actorEmail] : [],
  })
  return NextResponse.json({ sent })
}
