import { describe, it, expect } from 'vitest'
import { normalizeSubject } from '@/lib/mail/pipeline'

describe('normalizeSubject', () => {
  it('ignore RE:/TR:/FWD: et la casse', () => {
    expect(normalizeSubject('RE: TR:  Commande CMD-0010 ')).toBe('commande cmd-0010')
    expect(normalizeSubject('Fwd: Commande   CMD-0010')).toBe('commande cmd-0010')
  })
  it('garde un sujet sans préfixe tel quel', () => {
    expect(normalizeSubject('Horaires Google Nemours')).toBe('horaires google nemours')
  })
})
