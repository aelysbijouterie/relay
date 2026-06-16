import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const checks = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true }),
    supabase.from('task_comments').select('id', { count: 'exact', head: true }),
    supabase.from('task_subtasks').select('id', { count: 'exact', head: true }),
    supabase.from('task_attachments').select('id', { count: 'exact', head: true }),
    supabase.storage.getBucket('task-attachments'),
  ])

  return NextResponse.json({
    tables: {
      tasks:            { ok: !checks[0].error, count: checks[0].count, error: checks[0].error?.message },
      task_comments:    { ok: !checks[1].error, count: checks[1].count, error: checks[1].error?.message },
      task_subtasks:    { ok: !checks[2].error, count: checks[2].count, error: checks[2].error?.message },
      task_attachments: { ok: !checks[3].error, count: checks[3].count, error: checks[3].error?.message },
    },
    storage: {
      bucket_task_attachments: { ok: !checks[4].error, error: checks[4].error?.message },
    },
  })
}
