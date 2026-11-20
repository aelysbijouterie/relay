import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildSessionCookie } from '@/lib/supabase/session'
import { signSessionValue } from '@/lib/session-cookie'
import { createAdminClient } from '@/lib/supabase/server'
import { HOME_COOKIE, HOME_VIEWS } from '@/lib/home-view'
import { SESSION_MAX_AGE } from '@/lib/session-config'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 })
  }

  const session = buildSessionCookie({
    accessToken:  data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt:    data.session.expires_at,
    expiresIn:    data.session.expires_in,
    userId:       data.user.id,
    email:        data.user.email,
  })

  const response = NextResponse.json({ ok: true })
  response.cookies.set('relays-session', signSessionValue(session), {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   SESSION_MAX_AGE, // 1 an, renouvelé à chaque visite (middleware)
  })

  // Compte de boutique ? Un cookie restreint les vues accessibles (voir
  // middleware.ts) ; sinon on nettoie d'éventuels restes d'une session boutique.
  const { data: prof } = await createAdminClient()
    .from('profiles').select('is_boutique_account, boutique_id').eq('id', data.user.id).single()
  if (prof?.is_boutique_account && prof.boutique_id) {
    response.cookies.set('relays-boutique', prof.boutique_id as string, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE,
    })
  } else {
    response.cookies.delete('relays-boutique')
  }
  response.cookies.delete('relays-member')

  // Vue favorite enregistrée dans le profil (colonne facultative : sans elle, on garde le réglage du navigateur).
  const { data: dv } = await createAdminClient().from('profiles').select('default_view').eq('id', data.user.id).single()
  const fav = (dv as { default_view?: string | null } | null)?.default_view
  if (fav && HOME_VIEWS.some(h => h.href === fav)) {
    response.cookies.set(HOME_COOKIE, fav, { secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 })
  }

  return response
}
