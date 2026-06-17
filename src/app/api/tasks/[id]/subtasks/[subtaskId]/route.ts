import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string; subtaskId: string } }) {
  const body = await request.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('task_subtasks')
    .update({ is_done: body.is_done })
    .eq('id', params.subtaskId)
    .eq('task_id', params.id)
    .select('id, title, is_done, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; subtaskId: string } }) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('task_subtasks')
    .delete()
    .eq('id', params.subtaskId)
    .eq('task_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
