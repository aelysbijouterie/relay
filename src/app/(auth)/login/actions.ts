'use server'

import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export async function loginAction(formData: FormData) {
  const email    = (formData.get('email') as string ?? '').trim()
  const password = (formData.get('password') as string ?? '').trim()

  if (!email || !password) {
    redirect('/login?error=1')
  }

  try {
    const supabase = createServerClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      console.error('[login] Supabase error:', error.message)
      redirect('/login?error=1')
    }
  } catch (err: unknown) {
    // Relancer les redirects Next.js (NEXT_REDIRECT) — ne pas les avaler
    const e = err as { digest?: string }
    if (e?.digest?.startsWith('NEXT_REDIRECT')) throw err
    console.error('[login] Unexpected error:', err)
    redirect('/login?error=1')
  }

  redirect('/kanban')
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
