import { NextRequest, NextResponse } from 'next/server'
import { requireTaskAccess } from '@/lib/tasks/access'
import { readSessionUserId } from '@/lib/session-cookie'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  { const denied = await requireTaskAccess(params.id); if (denied) return denied }
  const authUserId = readSessionUserId()
  if (!authUserId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_activity')
    .select('id, type, field, old_value, new_value, created_at, actor:profiles!actor_id(id, name, avatar_url)')
    .eq('task_id', params.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Activity error:', error.message)
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  }

  const activity = (data ?? []).map((a: Record<string, unknown>) => ({
    ...a,
    actor: Array.isArray(a.actor) ? a.actor[0] ?? null : a.actor ?? null,
  }))

  return NextResponse.json(activity, { headers: { 'Cache-Control': 'no-store' } })
}