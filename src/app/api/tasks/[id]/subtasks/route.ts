import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_subtasks')
    .select('id, title, is_done, created_at')
    .eq('task_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { title } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Titre requis' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_subtasks')
    .insert({ task_id: params.id, title: title.trim(), created_by: userId })
    .select('id, title, is_done, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
