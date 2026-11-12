import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

/**
 * Cookie de session SIGNÉ.
 *
 * Avant : le cookie `relays-session` était un simple JSON — n'importe qui pouvait écrire `{"user_id":"…"}` et
 * se faire passer pour un autre utilisateur. Désormais le cookie vaut `v1.<charge utile>.<signature HMAC-SHA256>` :
 * sans le secret du serveur, impossible de fabriquer ou de modifier une session.
 * Le secret est `SESSION_SECRET` s'il existe, sinon `SUPABASE_SERVICE_ROLE_KEY` (déjà secrète et propre au serveur).
 * Tout cookie invalide (ancien format, falsifié, secret absent) est traité comme « non connecté ».
 */
export const SESSION_COOKIE = 'relays-session'
const PREFIX = 'v1.'

function secret(): string {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url')

export function signSessionValue(session: object): string {
  if (!secret()) throw new Error('Secret de session absent')
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${PREFIX}${payload}.${sign(payload)}`
}

export function parseSessionValue<T = { user_id?: string; email?: string }>(raw: string | null | undefined): (T & { user_id?: string }) | null {
  if (!raw || !raw.startsWith(PREFIX) || !secret()) return null
  const body = raw.slice(PREFIX.length)
  const dot = body.lastIndexOf('.')
  if (dot < 1) return null
  const payload = body.slice(0, dot), given = body.slice(dot + 1)
  const expected = sign(payload)
  const a = Buffer.from(given), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) } catch { return null }
}

/** Identifiant de l'utilisateur connecté, ou null (cookie absent, falsifié ou ancien). */
export function readSessionUserId(): string | null {
  try { return parseSessionValue(cookies().get(SESSION_COOKIE)?.value)?.user_id ?? null } catch { return null }
}
