import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/tasks/activity'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_subtasks')
    .select('id, title, is_done, group_name, position, created_at')
    .eq('task_id', params.id)
    .order('group_name', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const title = (body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
  const groupName = (body.group_name ?? 'Général').trim() || 'Général'

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_subtasks')
    .insert({ task_id: params.id, title, created_by: userId, group_name: groupName })
    .select('id, title, is_done, group_name, position, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logActivity({ taskId: params.id, actorId: userId, type: 'subtask', newValue: `Ajout : ${title.slice(0, 80)}` })
  return NextResponse.json(data)
}