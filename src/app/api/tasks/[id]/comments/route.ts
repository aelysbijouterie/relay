import { NextRequest, NextResponse } from 'next/server'
import { requireTaskAccess } from '@/lib/tasks/access'
import { readSessionUserId } from '@/lib/session-cookie'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/tasks/activity'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  return readSessionUserId()
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  { const denied = await requireTaskAccess(params.id); if (denied) return denied }
  const authUserId = readSessionUserId()
  if (!authUserId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_comments')
    .select('id, content, created_at, author:profiles(id, name, avatar_url, department:departments(color))')
    .eq('task_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  { const denied = await requireTaskAccess(params.id); if (denied) return denied }
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { content } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Contenu vide' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_comments')
    .insert({ task_id: params.id, author_id: userId, content: content.trim() })
    .select('id, content, created_at, author:profiles(id, name, avatar_url, department:departments(color))')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logActivity({ taskId: params.id, actorId: userId, type: 'comment', newValue: content.trim().slice(0, 120) })
  return NextResponse.json(data)
}