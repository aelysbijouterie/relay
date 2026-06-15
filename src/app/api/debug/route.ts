import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const raw = request.cookies.get('relays-session')?.value
  const userId = raw ? JSON.parse(raw).user_id : null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [tasksCount, profile, tasksQuery] = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true }),
    userId ? supabase.from('profiles').select('id, name, department_id').eq('id', userId).single() : Promise.resolve({ data: null, error: 'no userId' }),
    supabase.from('tasks').select('id, title, status, department_id, created_at').limit(5).order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    userId,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    tasksTotal:    tasksCount.count,
    tasksError:    tasksCount.error?.message,
    profile:       profile.data,
    profileError:  typeof profile.error === 'string' ? profile.error : (profile as { error?: { message?: string } }).error?.message,
    recentTasks:   tasksQuery.data,
    recentError:   tasksQuery.error?.message,
  })
}
