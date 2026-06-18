/**
 * Route appelée par un cron job quotidien (ex: Vercel Cron ou GitHub Actions)
 * Envoie des rappels J-3 et J-1 aux assignés des tâches dont la deadline approche.
 *
 * Sécuriser avec CRON_SECRET : Authorization: Bearer <CRON_SECRET>
 */
import { sendEmail } from '@/lib/email'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { addDays, format, startOfDay, endOfDay, isWithinInterval } from 'date-fns'
import { fr } from 'date-fns/locale'

export async function GET(request: NextRequest) {
  // Vérification du secret cron
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role pour contourner RLS
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const today = startOfDay(new Date())
  const in1day = endOfDay(addDays(today, 1))
  const in3days = endOfDay(addDays(today, 3))

  // Récupérer les tâches dont la deadline est dans 1 ou 3 jours
  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      id, title, deadline, priority, status,
      department:departments!department_id(name, color),
      assignees:task_assignees(user:profiles(id, name, email))
    `)
    .in('status', ['A Faire', 'En cours', 'Bloqué', 'A revoir'])
    .gte('deadline', today.toISOString())
    .lte('deadline', in3days.toISOString())

  if (!tasks?.length) return NextResponse.json({ sent: 0, message: 'Aucune deadline à venir' })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  let sent = 0

  for (const task of tasks) {
    const deadline = new Date(task.deadline)
    const isJ1 = isWithinInterval(deadline, { start: today, end: in1day })
    const isJ3 = isWithinInterval(deadline, { start: addDays(today, 2), end: in3days })
    const label = isJ1 ? 'demain' : 'dans 3 jours'
    const urgency = isJ1 ? '🔴' : '🟡'

    const assignees = (task.assignees ?? []).map((a: { user: { id: string; name: string; email: string }[] }) => a.user[0]).filter(Boolean)
    if (!assignees.length) continue

    const dept = (Array.isArray(task.department) ? task.department[0] : task.department) as { name: string; color: string } | null

    await Promise.allSettled(
      assignees.map((user: { email: string; name: string }) =>
        sendEmail({
          to: user.email,
          subject: `${urgency} Rappel deadline ${label} : ${task.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
              <div style="background: linear-gradient(135deg, ${dept?.color ?? '#94A3B8'}, ${dept?.color ?? '#94A3B8'}99); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <p style="color:white;margin:0;font-size:12px;font-weight:600;letter-spacing:1px;">RELAYS — Rappel deadline</p>
                <h1 style="color:white;margin:12px 0 0;font-size:20px;">La deadline approche ${urgency}</h1>
              </div>
              <p style="color:#374151;font-size:15px;">Bonjour <strong>${user.name}</strong>,</p>
              <p style="color:#374151;font-size:15px;">La tâche <strong>"${task.title}"</strong> arrive à échéance <strong>${label}</strong> (${format(deadline, 'd MMMM yyyy', { locale: fr })}).</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid ${dept?.color ?? '#94A3B8'};border-radius:8px;padding:16px;margin:20px 0;">
                <p style="margin:0;color:#6b7280;font-size:13px;">Priorité : <strong style="color:#111827;">${task.priority}</strong></p>
                <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">Statut actuel : <strong style="color:#111827;">${task.status}</strong></p>
              </div>
              <a href="${appUrl}/kanban" style="display:inline-block;background:${dept?.color ?? '#3B82F6'};color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">
                Voir la tâche →
              </a>
              <p style="color:#9ca3af;font-size:11px;margin-top:32px;">RELAYS · Aelys · Message automatique</p>
            </div>
          `,
        })
      )
    )

    sent += assignees.length
  }

  return NextResponse.json({ sent, tasks: tasks.length })
}