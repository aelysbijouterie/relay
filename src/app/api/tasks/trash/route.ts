import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Liste les tâches en corbeille (supprimées, récupérables).
export async function GET() {
  const userId = getUserId()
  if (!userId) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id, title, status, priority, deadline, deleted_at, created_by,
      department:departments!department_id(id, name, color, slug),
      assignees:task_assignees(user:profiles(id, name, avatar_url))
    `)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })

  const mapped = (data ?? []).map((t: Record<string, unknown>) => ({
    ...t,
    assignees: ((t.assignees as { user: unknown }[]) ?? []).map(a => a.user).filter(Boolean),
  }))

  // Visibilité PERSONNELLE stricte : chacun ne voit que sa propre corbeille
  // (créateur ou assigné), jamais celle de ses collègues.
  const visible = (mapped as { created_by?: string; assignees: { id: string }[] }[]).filter(t =>
    t.created_by === userId || t.assignees.some(a => a.id === userId))

  return NextResponse.json(visible, { headers: { 'Cache-Control': 'no-store' } })
}
