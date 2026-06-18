import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Cron quotidien : archive les tâches "Terminé" dont le délai (propre à
// leur département) est dépassé depuis completed_at.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Délais par département (0 = jamais)
  const { data: depts } = await supabase
    .from('departments')
    .select('id, auto_archive_days')

  if (!depts?.length) return NextResponse.json({ archived: 0 })

  const now = Date.now()
  let archived = 0

  for (const dept of depts) {
    const days = dept.auto_archive_days ?? 0
    if (!days || days <= 0) continue // archivage désactivé pour ce département

    const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString()

    // Tâches terminées de ce département, complétées avant le seuil
    const { data: toArchive } = await supabase
      .from('tasks')
      .select('id')
      .eq('department_id', dept.id)
      .eq('status', 'Terminé')
      .not('completed_at', 'is', null)
      .lte('completed_at', cutoff)

    if (!toArchive?.length) continue

    const ids = toArchive.map(t => t.id)
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'Archivé', updated_at: new Date().toISOString() })
      .in('id', ids)

    if (!error) {
      archived += ids.length
      // Trace dans l'historique (archivage automatique, actor_id null)
      await supabase.from('task_activity').insert(
        ids.map(id => ({ task_id: id, actor_id: null, type: 'archived', new_value: 'Archivage automatique' }))
      )
    }
  }

  console.log(`[cron/archive] ${archived} tâches archivées`)
  return NextResponse.json({ archived })
}