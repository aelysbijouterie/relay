'use server'

import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function login(email: string, password: string) {
  const supabase = createServerClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function logout() {
  // Déconnexion Supabase si session active
  try {
    const supabase = createServerClient()
    await supabase.auth.signOut()
  } catch {}
  redirect('/login')
}

export async function inviteUser(email: string, departmentId: string, role: string) {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'manager'].includes(profile?.role ?? '')) {
    throw new Error('Permission refusée')
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { department_id: departmentId, role },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  })

  if (error) throw new Error(error.message)
  return { success: true }
}

export async function updateProfile(name: string, avatarUrl?: string) {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const updates: Record<string, string> = { name }
  if (avatarUrl) updates.avatar_url = avatarUrl

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
  return { success: true }
}
