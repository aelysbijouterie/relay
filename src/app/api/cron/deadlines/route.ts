import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyByPreference } from '@/lib/notify'
import { emailDeadlineReminder } from '@/emails/templates'
import { addDays, startOfDay, endOfDay } from 'date-fns'

// Appelé par Vercel Cron tous les matins à 8h (voir vercel.json)
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const today = startOfDay(new Date())
  const j1end = endOfDay(addDays(today, 1))
  const j3end = endOfDay(addDays(today, 3))

  // Tâches avec échéance dans les 3 jours, non terminées ni archivées
  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      id, title, description, status, priority, deadline, is_cross_team,
      department:departments!department_id(name, color),
      assignees:task_assignees(user:profiles(id, name, email))
    `)
    .not('status', 'in', '("Terminé","Archivé")')
    .gte('deadline', today.toISOString())
    .lte('deadline', j3end.toISOString())

  if (!tasks?.length) return NextResponse.json({ sent: 0 })

  let sent = 0

  for (const task of tasks) {
    const deadline  = new Date(task.deadline)
    const daysLeft  = deadline <= endOfDay(addDays(today, 1)) ? 1 : 3
    const dept      = Array.isArray(task.department) ? task.department[0] : task.department
    const assignees = (task.assignees ?? []).map((a: { user: { name: string; email: string }[] | { name: string; email: string } }) =>
      Array.isArray(a.user) ? a.user[0] : a.user
    ).filter(Boolean)

    for (const user of assignees) {
      const tpl = emailDeadlineReminder({
        assigneeName: user.name.split(' ')[0],
        task: { ...task, deadline: task.deadline },
        department: dept as { name: string; color: string },
        daysLeft: daysLeft as 1 | 3,
      })
      sent += await notifyByPreference({
        emails: [user.email],
        pref: 'notify_email_deadlines',
        subject: tpl.subject,
        html: tpl.html,
      })
    }
  }

  console.log(`[cron/deadlines] ${sent} rappels envoyés`)
  return NextResponse.json({ sent })
}