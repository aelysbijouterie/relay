import { describe, it, expect, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }))
process.env.SESSION_SECRET = 'secret-de-test'

describe('cookie de session signé', async () => {
  const { signSessionValue, parseSessionValue } = await import('@/lib/session-cookie')
  const good = signSessionValue({ user_id: 'u1', email: 'a@b.fr' })

  it('un cookie signé par le serveur est lu', () => expect(parseSessionValue(good)?.user_id).toBe('u1'))
  it('un cookie falsifié est refusé', () => {
    const payload = Buffer.from(JSON.stringify({ user_id: 'admin' })).toString('base64url')
    expect(parseSessionValue(`v1.${payload}.${'A'.repeat(43)}`)).toBeNull()
  })
  it('une charge utile modifiée est refusée', () => {
    const payload = Buffer.from(JSON.stringify({ user_id: 'admin' })).toString('base64url')
    expect(parseSessionValue(good.replace(/^v1\.[^.]+/, `v1.${payload}`))).toBeNull()
  })
  it('l’ancien format (JSON brut) est refusé', () => expect(parseSessionValue('{"user_id":"u1"}')).toBeNull())
})
