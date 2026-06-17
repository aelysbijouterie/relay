import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { canMutateTask } from '@/lib/tasks/activity'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Tags d'une tâche
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_tags')
    .select('tag:tags(id, name, color)')
    .eq('task_id', params.id)

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  const tags = (data ?? []).map((r: Record<string, unknown>) => r.tag).filter(Boolean)
  return NextResponse.json(tags, { headers: { 'Cache-Control': 'no-store' } })
}

// Remplacer l'ensemble des tags d'une tâche (liste d'ids)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!(await canMutateTask(params.id, userId))) {
    return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
  }

  const body = await request.json()
  const tagIds: string[] = Array.isArray(body.tagIds) ? body.tagIds : []

  const supabase = createAdminClient()
  await supabase.from('task_tags').delete().eq('task_id', params.id)
  if (tagIds.length) {
    const { error } = await supabase.from('task_tags').insert(tagIds.map(tag_id => ({ task_id: params.id, tag_id })))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}