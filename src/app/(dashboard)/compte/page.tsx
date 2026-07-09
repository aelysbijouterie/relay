import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { AccountView } from '@/components/account/AccountView'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ComptePage() {
  const raw = cookies().get('relays-session')?.value
  if (!raw) redirect('/login')

  let userId: string
  try { userId = JSON.parse(raw).user_id } catch { redirect('/login') }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select(
      'id, name, email, avatar_url, role, department_id, extra_department_ids, conges_default_dept_ids, ' +
      'notify_email_assigned, notify_email_status, notify_email_deadlines, notify_email_weekly, notify_email_mentions, ' +
      'show_holidays, show_school_holidays, show_absences_calendar, ' +
      'department:departments!department_id(id, name, color, slug, auto_archive_days)'
    )
    .eq('id', userId!)
    .single()

  if (!data) redirect('/login')

  const row = data as unknown as {
    role: string
    department: { id?: string; name?: string; auto_archive_days?: number } | null
  }
  const dept = row.department
  const isManager = row.role === 'manager' || row.role === 'admin'

  return (
    <AccountView
      profile={data as unknown as Profile}
      teamSettings={isManager && dept?.id ? {
        departmentId: dept.id,
        departmentName: dept.name ?? '',
        autoArchiveDays: dept.auto_archive_days ?? 7,
      } : null}
    />
  )
}