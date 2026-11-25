import { describe, it, expect } from 'vitest'
import { isoWeekNumber } from '@/lib/calendar/weekNumber'
import { dayPeriodOf } from '@/lib/absences/dayPeriod'

describe('isoWeekNumber', () => {
  it('semaines ISO connues', () => {
    expect(isoWeekNumber(new Date(2026, 0, 1))).toBe(1)    // jeudi 1er janvier 2026
    expect(isoWeekNumber(new Date(2026, 10, 25))).toBe(48) // mercredi 25 novembre 2026
    expect(isoWeekNumber(new Date(2026, 11, 28))).toBe(53) // lundi 28 décembre 2026 (2026 a 53 semaines)
    expect(isoWeekNumber(new Date(2027, 0, 1))).toBe(53)   // vendredi 1er janvier 2027 : encore semaine 53 de 2026
    expect(isoWeekNumber(new Date(2027, 0, 4))).toBe(1)    // lundi 4 janvier 2027
    expect(isoWeekNumber(new Date(2025, 11, 29))).toBe(1)  // lundi 29 décembre 2025 : semaine 1 de 2026
  })
  it('lundi et dimanche d’une même semaine ont le même numéro', () => {
    expect(isoWeekNumber(new Date(2026, 10, 23))).toBe(isoWeekNumber(new Date(2026, 10, 29)))
  })
})

describe('dayPeriodOf', () => {
  const base = { start_date: '2026-12-07', end_date: '2026-12-09', start_period: 'pm' as const, end_period: 'am' as const }
  it('absence sur plusieurs jours : demi-journées aux deux bouts seulement', () => {
    expect(dayPeriodOf(base, '2026-12-07')).toBe('pm')
    expect(dayPeriodOf(base, '2026-12-08')).toBe('full')
    expect(dayPeriodOf(base, '2026-12-09')).toBe('am')
  })
  it('un seul jour : la période du premier jour', () => {
    expect(dayPeriodOf({ ...base, end_date: '2026-12-07' }, '2026-12-07')).toBe('pm')
  })
})
