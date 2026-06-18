import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyByPreference } from '@/lib/notify'
import { emailWeeklyRecap } from '@/emails/templates'
import { endOfWeek, parseISO, isWithinInterval, startOfDay } from 'date-fns'

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

  const today   = startOfDay(new Date())
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
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
      .filter(Boolean) as Parameters<typeof emailWeeklyRecap>[0]['tasks']

    // Rien à envoyer si aucune tâche (consigne : pas de mail "vide")
    if (!tasks.length) continue

    // Tri : d'abord les tâches à échéance CETTE SEMAINE (par date croissante),
    // puis toutes les autres (à faire / en cours / bloqué…).
    const inThisWeek = (d: string | null | undefined) =>
      !!d && isWithinInterval(parseISO(d), { start: today, end: weekEnd })

    tasks.sort((a, b) => {
      const aWeek = inThisWeek(a.deadline), bWeek = inThisWeek(b.deadline)
      if (aWeek && !bWeek) return -1
      if (!aWeek && bWeek) return 1
      if (aWeek && bWeek) return (a.deadline ?? '').localeCompare(b.deadline ?? '')
      return 0
    })

    const dept = (Array.isArray(profile.department) ? profile.department[0] : profile.department) as { name: string; color: string }

    const tpl = emailWeeklyRecap({
      name: profile.name.split(' ')[0],
      tasks,
      department: dept ?? { name: 'Aelys', color: '#FF6B35' },
    })

    sent += await notifyByPreference({
      emails: [profile.email],
      pref: 'notify_email_weekly',
      subject: tpl.subject,
      html: tpl.html,
    })
  }

  console.log(`[cron/weekly] ${sent} récaps envoyés`)
  return NextResponse.json({ sent })
}