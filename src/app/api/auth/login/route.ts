import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

  const response = NextResponse.json({ ok: true })
  response.cookies.set('relays-session', JSON.stringify({
    access_token: data.session.access_token,
    user_id:      data.user.id,
    email:        data.user.email,
  }), {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 7, // 7 jours
  })

  return response
}
