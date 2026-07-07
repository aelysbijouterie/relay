import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { occurrencesInRange } from '@/lib/recurring/schedule'
import type { RecurringFrequency } from '@/types/recurring'

export const dynamic = 'force-dynamic'

function localDs(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Cron quotidien : crée les cartes récurrentes dont l'ÉCHÉANCE tombe dans les
// `lead_days` prochains jours. L'échéance = la date de récurrence.
// Chaque carte n'est créée qu'une fois (contrôle via recurring_task_id + deadline).
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: models } = await supabase
    .from('recurring_tasks').select('*').eq('is_active', true)

  let created = 0
  for (const m of models ?? []) {
    const lead = Number.isFinite(m.lead_days) ? Math.max(0, m.lead_days) : 3
    const windowEnd = new Date(today)
    windowEnd.setDate(windowEnd.getDate() + lead)

    // Échéances qui tombent dans la fenêtre [aujourd'hui, aujourd'hui + lead].
    const dueDates = occurrencesInRange(
      m.frequency as RecurringFrequency,
      { weekday: m.weekday, month_day: m.month_day },
      today, windowEnd
    )
    if (dueDates.length === 0) continue

    // Cartes déjà générées pour ce modèle (pour ne pas dupliquer).
    const { data: existing } = await supabase
      .from('tasks').select('deadline').eq('recurring_task_id', m.id)
    const alreadyDone = new Set((existing ?? []).map(e => (e.deadline ?? '').slice(0, 10)))

    for (const dueDate of dueDates) {
      if (alreadyDone.has(dueDate)) continue

      const { data: card, error } = await supabase
        .from('tasks')
        .insert({
          title: m.title,
          description: m.description,
          priority: m.priority || 'Moyenne',
          department_id: m.department_id,
          status: 'A Faire',
          deadline: dueDate,          // échéance = jour prévu de récurrence
          created_by: m.created_by,
          recurring_task_id: m.id,
        })
        .select('id')
        .single()
      if (error || !card) continue

      if (Array.isArray(m.assignee_ids) && m.assignee_ids.length > 0) {
        await supabase.from('task_assignees').insert(
          m.assignee_ids.map((uid: string) => ({ task_id: card.id, user_id: uid }))
        )
      }
      created++
    }

    await supabase.from('recurring_tasks').update({ last_run_date: localDs(today) }).eq('id', m.id)
  }

  console.log(`[cron/recurring] ${created} carte(s) récurrente(s) créée(s)`)
  return NextResponse.json({ created })
}
