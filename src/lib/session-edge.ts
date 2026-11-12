/**
 * Vérification de la signature du cookie de session pour le middleware (runtime Edge : Web Crypto, asynchrone).
 * Même algorithme que `session-cookie.ts` (HMAC-SHA256, signature en base64url).
 */
const PREFIX = 'v1.'

function secret(): string {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function toBase64Url(buf: ArrayBuffer): string {
  let s = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function isValidSessionValue(raw: string | null | undefined): Promise<boolean> {
  if (!raw || !raw.startsWith(PREFIX) || !secret()) return false
  const body = raw.slice(PREFIX.length)
  const dot = body.lastIndexOf('.')
  if (dot < 1) return false
  const payload = body.slice(0, dot), given = body.slice(dot + 1)
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const expected = toBase64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
    if (expected.length !== given.length) return false
    let diff = 0
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i)
    return diff === 0
  } catch { return false }
}
