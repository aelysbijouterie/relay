import { describe, it, expect } from 'vitest'
import { countWorkdays } from '@/lib/absences/workdays'

const shop = { saturdays: true }

describe('décompte des jours — siège (lundi → vendredi)', () => {
  it('une semaine complète = 5 jours', () => expect(countWorkdays('2026-11-02', '2026-11-06')).toBe(5))
  it('le samedi ne compte pas', () => expect(countWorkdays('2026-11-07', '2026-11-07')).toBe(0))
  it('un jour férié ne compte pas (11 novembre 2026)', () => expect(countWorkdays('2026-11-09', '2026-11-13')).toBe(4))
  it('une demi-journée retire 0,5 j', () => expect(countWorkdays('2026-11-02', '2026-11-02', 'am', 'am')).toBe(0.5))
})

describe('décompte des jours — boutiques (samedis, 5 jours par semaine au plus)', () => {
  it('lundi → samedi = 5 jours (jour de repos déduit)', () => expect(countWorkdays('2026-11-02', '2026-11-07', 'full', 'full', shop)).toBe(5))
  it('un samedi posé seul = 1 jour', () => expect(countWorkdays('2026-11-07', '2026-11-07', 'full', 'full', shop)).toBe(1))
  it('mercredi → samedi = 4 jours', () => expect(countWorkdays('2026-11-04', '2026-11-07', 'full', 'full', shop)).toBe(4))
  it('mardi → samedi = 5 jours', () => expect(countWorkdays('2026-11-03', '2026-11-07', 'full', 'full', shop)).toBe(5))
  it('le dimanche ne compte jamais', () => expect(countWorkdays('2026-11-08', '2026-11-08', 'full', 'full', shop)).toBe(0))
  it('deux semaines avec un férié en semaine = 10 jours', () => expect(countWorkdays('2026-11-02', '2026-11-14', 'full', 'full', shop)).toBe(10))
  it('samedi en demi-journée = 0,5 jour', () => expect(countWorkdays('2026-11-07', '2026-11-07', 'am', 'am', shop)).toBe(0.5))
  it('vendredi → lundi (ven + sam + lun) = 3 jours', () => expect(countWorkdays('2026-11-06', '2026-11-09', 'full', 'full', shop)).toBe(3))
})
