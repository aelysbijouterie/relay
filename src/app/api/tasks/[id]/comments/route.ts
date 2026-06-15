import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function createAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getUserId(): string | null {
  const cookieStore = cookies()
  const raw = cookieStore.get('relays-session')?.value
  if (!raw) return null
  try { return JSON.parse(raw).user_id ?? null } catch { return null }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { content } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Contenu vide' }, { status: 400 })

  const supabase = createAdmin()
  const { data, error } = await supabase
    .from('task_comments')
    .insert({ task_id: params.id, author_id: userId, content: content.trim() })
    .select('id, content, created_at, author:profiles(id, name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
