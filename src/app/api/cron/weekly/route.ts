import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { emailWeeklyRecap } from '@/emails/templates'

// Appelé par Vercel Cron tous les lundis à 8h (voir vercel.json)
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Récupérer tous les profils actifs avec leur département
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email, department_id, department:departments(name, color)')
    .eq('is_active', true)

  if (!profiles?.length) return NextResponse.json({ sent: 0 })

  let sent = 0

  for (const profile of profiles) {
    // Tâches assignées à cette personne, non terminées ni archivées
    const { data: taskRows } = await supabase
      .from('task_assignees')
      .select('task:tasks(id, title, description, status, priority, deadline, is_cross_team)')
      .eq('user_id', profile.id)
      .not('task.status', 'in', '("Terminé","Archivé")')

    const tasks = (taskRows ?? [])
      .map((r: { task: unknown }) => r.task)
      .filter(Boolean)

    if (!tasks.length) continue

    const dept = (Array.isArray(profile.department) ? profile.department[0] : profile.department) as { name: string; color: string }

    const tpl = emailWeeklyRecap({
      name: profile.name,
      tasks: tasks as Parameters<typeof emailWeeklyRecap>[0]['tasks'],
      department: dept ?? { name: 'Aelys', color: '#FF6B35' },
    })

    await sendEmail({ to: profile.email, subject: tpl.subject, html: tpl.html })
    sent++
  }

  console.log(`[cron/weekly] ${sent} récaps envoyés`)
  return NextResponse.json({ sent })
}
