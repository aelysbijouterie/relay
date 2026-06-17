import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export interface SessionCookie {
  access_token:  string
  refresh_token: string
  expires_at:    number // epoch secondes
  user_id:       string
  email:         string
}

const COOKIE_NAME             = 'relays-session'
const COOKIE_MAX_AGE          = 60 * 60 * 24 * 7 // 7 jours
const REFRESH_MARGIN_SECONDS  = 120 // on rafraîchit 2 min avant l'expiration réelle

function readSessionCookie(): SessionCookie | null {
  const raw = cookies().get(COOKIE_NAME)?.value
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<SessionCookie>
    if (!parsed.access_token || !parsed.refresh_token || !parsed.user_id || !parsed.expires_at) {
      return null
    }
    return parsed as SessionCookie
  } catch {
    return null
  }
}

function writeSessionCookie(session: SessionCookie): void {
  cookies().set(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   COOKIE_MAX_AGE,
  })
}

/**
 * Construit le cookie de session à partir d'une réponse d'authentification
 * Supabase (login ou refresh). Utilisé par /api/auth/login.
 */
export function buildSessionCookie(params: {
  accessToken:  string
  refreshToken: string
  expiresAt:    number | undefined
  expiresIn:    number
  userId:       string
  email:        string | undefined
}): SessionCookie {
  return {
    access_token:  params.accessToken,
    refresh_token: params.refreshToken,
    expires_at:    params.expiresAt ?? Math.floor(Date.now() / 1000) + params.expiresIn,
    user_id:       params.userId,
    email:         params.email ?? '',
  }
}

export function setSessionCookie(session: SessionCookie): void {
  writeSessionCookie(session)
}

/**
 * Renvoie un access_token Supabase garanti valide, en le rafraîchissant via
 * le refresh_token stocké dans le cookie httpOnly si besoin. Le refresh_token
 * étant à usage unique (rotation à chaque appel), le nouveau couple
 * access/refresh est systématiquement réécrit dans le cookie.
 *
 * IMPORTANT : ne fonctionne que depuis un Route Handler ou une Server
 * Action — ce sont les seuls contextes Next.js où cookies().set() peut
 * modifier la réponse sortante. Depuis un Server Component, l'écriture du
 * cookie échouerait silencieusement (no-op) ; cette fonction n'est donc
 * appelée que par /api/auth/realtime-token.
 */
export async function getValidAccessToken(): Promise<{ access_token: string; expires_at: number } | null> {
  const session = readSessionCookie()
  if (!session) return null

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (session.expires_at - nowSeconds > REFRESH_MARGIN_SECONDS) {
    return { access_token: session.access_token, expires_at: session.expires_at }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: session.refresh_token })

  if (error || !data.session) {
    // refresh_token invalide/révoqué (ex : mot de passe changé entre-temps).
    // On renvoie tout de même l'ancien jeton plutôt que d'échouer : le pire
    // cas est un abonnement Realtime non autorisé (retombée sur le polling
    // SWR de 30 s), jamais une coupure du reste de l'app — qui ne dépend
    // pas de ce jeton puisque toutes les lectures serveur passent par le
    // client admin (service role).
    return { access_token: session.access_token, expires_at: session.expires_at }
  }

  const refreshed = buildSessionCookie({
    accessToken:  data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt:    data.session.expires_at,
    expiresIn:    data.session.expires_in,
    userId:       session.user_id,
    email:        session.email,
  })
  writeSessionCookie(refreshed)

  return { access_token: refreshed.access_token, expires_at: refreshed.expires_at }
}
