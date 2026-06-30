import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Reçoit l'ordre complet des sous-tâches { orderedIds: string[] } et écrit
// la nouvelle position de chacune (index dans le tableau).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { orderedIds } = await request.json()
  if (!Array.isArray(orderedIds)) return NextResponse.json({ error: 'orderedIds requis' }, { status: 400 })

  const supabase = createAdminClient()
  await Promise.all(
    orderedIds.map((sid: string, idx: number) =>
      supabase.from('task_subtasks').update({ position: idx }).eq('id', sid).eq('task_id', params.id)
    )
  )
  return NextResponse.json({ success: true })
}
