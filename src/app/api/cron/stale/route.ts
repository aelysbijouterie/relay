import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyByPreference } from '@/lib/notify'
import { emailStaleReminder, emailDelegatedStaleReminder } from '@/emails/templates'

export const dynamic = 'force-dynamic'

// Cron quotidien : rappelle les tâches actives sans mouvement depuis 7 jours.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const SEUIL_JOURS = 7
  const cutoff = new Date(Date.now() - SEUIL_JOURS * 86400000).toISOString()

  // Tâches "actives" non modifiées depuis le seuil.
  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      id, title, description, status, priority, deadline, updated_at, created_by,
      department:departments!department_id(name, color),
      assignees:task_assignees(user:profiles(id, name, email)),
      creator:profiles!created_by(id, name, email)
    `)
    .in('status', ['En cours', 'A Faire', 'Bloqué'])
    .is('deleted_at', null)
    .lte('updated_at', cutoff)

  if (!tasks?.length) return NextResponse.json({ sent: 0 })

  let sent = 0
  for (const task of tasks) {
    const dept = Array.isArray(task.department) ? task.department[0] : task.department
    const days = Math.floor((Date.now() - new Date(task.updated_at).getTime()) / 86400000)
    const assignees = (task.assignees ?? []).map((a: { user: { id: string; name: string; email: string }[] | { id: string; name: string; email: string } }) =>
      Array.isArray(a.user) ? a.user[0] : a.user
    ).filter(Boolean)

    for (const user of assignees) {
      const tpl = emailStaleReminder({
        assigneeName: user.name.split(' ')[0],
        task: { ...task, deadline: task.deadline },
        department: dept as { name: string; color: string },
        days,
      })
      sent += await notifyByPreference({
        emails: [user.email],
        pref: 'notify_email_deadlines',
        subject: tpl.subject,
        html: tpl.html,
      })
    }

    // Rappel au CRÉATEUR, s'il n'est pas lui-même assigné (tâche déléguée) —
    // pour qu'il puisse suivre l'avancement de ce qu'il a confié à d'autres.
    const creator = Array.isArray(task.creator) ? task.creator[0] : task.creator
    const creatorIsAssignee = assignees.some((a: { id: string }) => a.id === creator?.id)
    if (creator && !creatorIsAssignee) {
      const tplDelegated = emailDelegatedStaleReminder({
        creatorName: creator.name.split(' ')[0],
        assigneeNames: assignees.map((a: { name: string }) => a.name.split(' ')[0]),
        task: { ...task, deadline: task.deadline },
        department: dept as { name: string; color: string },
        days,
      })
      sent += await notifyByPreference({
        emails: [creator.email],
        pref: 'notify_email_deadlines',
        subject: tplDelegated.subject,
        html: tplDelegated.html,
      })
    }
  }

  console.log(`[cron/stale] ${sent} rappel(s) de tâche en pause envoyé(s)`)
  return NextResponse.json({ sent })
}
