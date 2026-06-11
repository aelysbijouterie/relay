'use server'

import { createServerClient } from '@/lib/supabase/server'

export async function getDepartments() {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name')

  if (error) throw new Error(error.message)
  return data
}

export async function getDepartmentMembers(departmentId: string) {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, avatar_url, is_active')
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .order('name')

  if (error) throw new Error(error.message)
  return data
}

export async function getCurrentProfile() {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*, department:departments(*)')
    .eq('id', user.id)
    .single()

  return data
}
