import { NextRequest, NextResponse } from 'next/server'
import { requireTaskAccess } from '@/lib/tasks/access'
import { readSessionUserId } from '@/lib/session-cookie'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  return readSessionUserId()
}

// Restaure une tâche depuis la corbeille (annule la suppression).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  { const denied = await requireTaskAccess(params.id); if (denied) return denied }
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
