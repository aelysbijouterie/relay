import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function createAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getUserId(request: NextRequest): string | null {
  const raw = request.cookies.get('relays-session')?.value
  if (!raw) return null
  try { return JSON.parse(raw).user_id ?? null } catch { return null }
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request)
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const supabase = createAdmin()

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id, title, description, status, priority, deadline,
      is_cross_team, fournisseur_client, ref_collection,
      parent_task_id, created_at, updated_at, department_id, created_by,
      department:departments(id, name, color, slug, icon),
      assignees:task_assignees(
        user:profiles(id, name, email, avatar_url, role, department_id,
          department:departments(id, name, color, slug))
      ),
      extra_departments:task_departments(department:departments(id, name, color, slug)),
      subtasks:tasks!tasks_parent_task_id_fkey(id, title, status, priority),
      comments:task_comments(id, content, created_at, author_id,
        author:profiles(id, name, avatar_url)
      )
    `)
    .neq('status', 'Archivé')
    .is('parent_task_id', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('Tasks fetch error:', error.message)
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  }

  const tasks = (data ?? []).map((t: Record<string, unknown>) => ({
    ...t,
    assignees:         ((t.assignees as { user: unknown }[]) ?? []).map(a => a.user).filter(Boolean),
    extra_departments: ((t.extra_departments as { department: unknown }[]) ?? []).map(a => a.department).filter(Boolean),
    subtasks:          (t.subtasks as unknown[]) ?? [],
    comments:          ((t.comments as { created_at: string }[]) ?? [])
                         .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }))

  return NextResponse.json(tasks, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
