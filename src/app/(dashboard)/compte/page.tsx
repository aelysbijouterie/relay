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
      'id, name, email, avatar_url, role, department_id, ' +
      'notify_email_assigned, notify_email_status, notify_email_deadlines, notify_email_weekly, ' +
      'department:departments!department_id(id, name, color, slug)'
    )
    .eq('id', userId!)
    .single()

  if (!data) redirect('/login')

  return <AccountView profile={data as unknown as Profile} />
}