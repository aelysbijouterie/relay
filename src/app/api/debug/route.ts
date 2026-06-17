import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createAdminClient()

  const [tasksCount, tasksQuery, profilesQuery] = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true }),
    supabase.from('tasks').select('id, title, status, department_id').limit(5).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name').limit(3),
  ])

  return NextResponse.json({
    ok:            true,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    tasksTotal:    tasksCount.count,
    tasksError:    tasksCount.error?.message ?? null,
    recentTasks:   tasksQuery.data ?? [],
    recentError:   tasksQuery.error?.message ?? null,
    profiles:      profilesQuery.data ?? [],
    profilesError: profilesQuery.error?.message ?? null,
  })
}
