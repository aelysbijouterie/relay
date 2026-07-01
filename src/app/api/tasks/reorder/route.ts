import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Reçoit l'ordre complet d'une colonne : { status, orderedIds: string[] }
// et écrit la position (index) de chaque carte de cette colonne.
export async function PATCH(request: NextRequest) {
  const { orderedIds } = await request.json()
  if (!Array.isArray(orderedIds)) return NextResponse.json({ error: 'orderedIds requis' }, { status: 400 })

  const supabase = createAdminClient()
  await Promise.all(
    orderedIds.map((id: string, idx: number) =>
      supabase.from('tasks').update({ position: idx + 1 }).eq('id', id)
    )
  )
  return NextResponse.json({ success: true })
}
