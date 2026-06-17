import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildSessionCookie } from '@/lib/supabase/session'

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
  response.cookies.set('relays-session', JSON.stringify(session), {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 7, // 7 jours
  })

  return response
}
