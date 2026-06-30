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
    .select('id, title, is_done, group_name, position, deadline, created_at')
    .eq('task_id', params.id)
    .order('group_name', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })

  // Charger les assignés de toutes les sous-tâches en une requête
  const subtaskIds = (data ?? []).map(s => s.id)
  let assigneesBySubtask = new Map<string, { id: string; name: string; avatar_url: string | null }[]>()
  if (subtaskIds.length > 0) {
    const { data: links } = await supabase
      .from('subtask_assignees')
      .select('subtask_id, user:profiles(id, name, avatar_url)')
      .in('subtask_id', subtaskIds)
    if (links) {
      for (const l of links as unknown as { subtask_id: string; user: { id: string; name: string; avatar_url: string | null } }[]) {
        if (!l.user) continue
        const arr = assigneesBySubtask.get(l.subtask_id) ?? []
        arr.push(l.user)
        assigneesBySubtask.set(l.subtask_id, arr)
      }
    }
  }

  const enriched = (data ?? []).map(s => ({ ...s, assignees: assigneesBySubtask.get(s.id) ?? [] }))
  return NextResponse.json(enriched, { headers: { 'Cache-Control': 'no-store' } })
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
    .select('id, title, is_done, group_name, position, deadline, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Héritage : la sous-tâche reprend par défaut les assignés de la carte.
  const { data: parentAssignees } = await supabase
    .from('task_assignees')
    .select('user_id')
    .eq('task_id', params.id)

  let inherited: { id: string; name: string; avatar_url: string | null }[] = []
  if (parentAssignees && parentAssignees.length > 0) {
    await supabase.from('subtask_assignees').insert(
      parentAssignees.map(a => ({ subtask_id: data.id, user_id: a.user_id }))
    )
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', parentAssignees.map(a => a.user_id))
    inherited = (profs ?? []) as { id: string; name: string; avatar_url: string | null }[]
  }

  await logActivity({ taskId: params.id, actorId: userId, type: 'subtask', newValue: `Ajout : ${title.slice(0, 80)}` })
  return NextResponse.json({ ...data, assignees: inherited })
}