import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isDue } from '@/lib/recurring/schedule'
import type { RecurringFrequency } from '@/types/recurring'

export const dynamic = 'force-dynamic'

function localDs(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Cron quotidien : crée les cartes des modèles récurrents dus aujourd'hui.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date()
  const todayStr = localDs(today)

  const { data: models } = await supabase
    .from('recurring_tasks').select('*').eq('is_active', true)

  let created = 0
  for (const m of models ?? []) {
    // Déjà généré aujourd'hui ? on saute (évite les doublons).
    if (m.last_run_date === todayStr) continue
    if (!isDue(m.frequency as RecurringFrequency, { weekday: m.weekday, month_day: m.month_day }, today)) continue

    // Créer la carte
    const { data: card, error } = await supabase
      .from('tasks')
      .insert({
        title: m.title,
        description: m.description,
        priority: m.priority || 'Moyenne',
        department_id: m.department_id,
        status: 'A Faire',
        created_by: m.created_by,
        recurring_task_id: m.id,
      })
      .select('id')
      .single()
    if (error || !card) continue

    // Assigner les personnes prévues
    if (Array.isArray(m.assignee_ids) && m.assignee_ids.length > 0) {
      await supabase.from('task_assignees').insert(
        m.assignee_ids.map((uid: string) => ({ task_id: card.id, user_id: uid }))
      )
    }

    // Marquer comme généré aujourd'hui
    await supabase.from('recurring_tasks').update({ last_run_date: todayStr }).eq('id', m.id)
    created++
  }

  console.log(`[cron/recurring] ${created} carte(s) récurrente(s) créée(s)`)
  return NextResponse.json({ created })
}
