'use server'

import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export async function loginAction(formData: FormData) {
  const email    = (formData.get('email') as string ?? '').trim()
  const password = (formData.get('password') as string ?? '').trim()

  if (!email || !password) return { error: 'Champs manquants' }

  const supabase = createServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: 'Identifiants incorrects' }

  return { success: true }
}

export async function demoAction(formData: FormData) {
  const slug = formData.get('slug') as string
  const SLUGS: Record<string, string> = {
    marketing: 'dept-marketing', web: 'dept-web',
    administratif: 'dept-compta', rh: 'dept-rh',
    logistique: 'dept-logistique', direction: 'dept-direction',
  }
  const deptId = SLUGS[slug]
  if (!deptId) redirect('/login')
  cookies().set('relays-demo', deptId, { path: '/', sameSite: 'lax', httpOnly: true })
  redirect('/kanban')
}
