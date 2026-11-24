import { describe, it, expect } from 'vitest'
import { expandWeeklyPeriods } from '@/lib/absences/recurrence'

describe('expandWeeklyPeriods', () => {
  it('tous les lundis et mardis : une période lundi→mardi par semaine', () => {
    // 2027-01-04 est un lundi
    expect(expandWeeklyPeriods('2027-01-04', '2027-01-19', [1, 2])).toEqual([
      { start: '2027-01-04', end: '2027-01-05' },
      { start: '2027-01-11', end: '2027-01-12' },
      { start: '2027-01-18', end: '2027-01-19' },
    ])
  })
  it('commence au premier jour voulu, s’arrête à la date butoire', () => {
    expect(expandWeeklyPeriods('2027-01-05', '2027-01-11', [1, 2])).toEqual([
      { start: '2027-01-05', end: '2027-01-05' },
      { start: '2027-01-11', end: '2027-01-11' },
    ])
  })
  it('jours non consécutifs = périodes séparées', () => {
    expect(expandWeeklyPeriods('2027-01-04', '2027-01-10', [1, 3])).toEqual([
      { start: '2027-01-04', end: '2027-01-04' },
      { start: '2027-01-06', end: '2027-01-06' },
    ])
  })
  it('rien si aucun jour ou dates incohérentes', () => {
    expect(expandWeeklyPeriods('2027-01-04', '2027-01-10', [])).toEqual([])
    expect(expandWeeklyPeriods('2027-02-01', '2027-01-10', [1])).toEqual([])
  })
})
