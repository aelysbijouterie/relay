import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyByPreference } from '@/lib/notify'
import { emailStatusChange } from '@/emails/templates'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Notifie les ASSIGNÉS + le CRÉATEUR d'un changement de statut, SAUF l'auteur
// du changement, et seulement ceux qui ont activé notify_email_status.
export async function POST(request: NextRequest) {
  const { taskId, oldStatus, changedByName } = await request.json()
  if (!taskId) return NextResponse.json({ sent: 0 })

  const actorId = getUserId()
  const supabase = createAdminClient()

  // On relit la tâche + ses destinataires en base (source de vérité).
  const { data: task } = await supabase
    .from('tasks')
    .select(`
      id, title, status, priority, deadline, created_by,
      department:departments!department_id(name, color),
      assignees:task_assignees(user:profiles(id, name, email))
    `)
    .eq('id', taskId)
    .single()

  if (!task) return NextResponse.json({ sent: 0 })

  const dept = (Array.isArray(task.department) ? task.department[0] : task.department) as { name: string; color: string } | null

  // Destinataires : assignés + créateur
  const assigneeUsers = (task.assignees ?? [])
    .map((a: { user: { id: string; name: string; email: string }[] | { id: string; name: string; email: string } }) =>
      Array.isArray(a.user) ? a.user[0] : a.user)
    .filter(Boolean) as { id: string; name: string; email: string }[]

  const { data: creator } = await supabase
    .from('profiles').select('id, name, email').eq('id', task.created_by).single()

  const recipientsMap = new Map<string, { id: string; name: string; email: string }>()
  for (const u of assigneeUsers) recipientsMap.set(u.id, u)
  if (creator) recipientsMap.set(creator.id, creator)

  // Exclure l'auteur du changement
  const actorEmail = actorId ? recipientsMap.get(actorId)?.email : undefined

  let sent = 0
  for (const u of recipientsMap.values()) {
    const tpl = emailStatusChange({
      assigneeName: u.name.split(' ')[0],
      changedByName,
      task: { ...task, status: task.status },
      oldStatus,
      department: dept ?? { name: '', color: '#94A3B8' },
    })
    sent += await notifyByPreference({
      emails: [u.email],
      pref: 'notify_email_status',
      subject: tpl.subject,
      html: tpl.html,
      exclude: actorEmail ? [actorEmail] : [],
    })
  }

  return NextResponse.json({ sent })
}