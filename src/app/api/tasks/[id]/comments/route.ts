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
    .from('task_comments')
    .select('id, content, created_at, author:profiles(id, name, avatar_url, department:departments(color))')
    .eq('task_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
  return NextResponse.json(data)
}
