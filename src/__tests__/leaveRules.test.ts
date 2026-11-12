import { describe, it, expect } from 'vitest'
import {
  automaticBlockedPeriods, blackFriday, winterSalesStart, summerSalesStart, mothersDay,
  leavePeriod, accruedMonths, evaluateLeaveRequest, LEAVE_PERIOD_CAP_DAYS,
} from '@/lib/absences/leaveRules'

const blockedOn = (date: string) => [2025, 2026, 2027, 2028].some(y => automaticBlockedPeriods(y).some(p => date >= p.start && date <= p.end))

describe('dates calculées', () => {
  it('Black Friday 2026 = vendredi 27 novembre', () => expect(blackFriday(2026)).toBe('2026-11-27'))
  it('soldes d’hiver 2027 : le 2e mercredi (13) dépasse le 12 → mercredi 6 janvier', () => expect(winterSalesStart(2027)).toBe('2027-01-06'))
  it('soldes d’été 2026 : dernier mercredi de juin (24)', () => expect(summerSalesStart(2026)).toBe('2026-06-24'))
  it('fête des mères 2026 = dimanche 31 mai', () => expect(mothersDay(2026)).toBe('2026-05-31'))
  it('la période de congés court du 1er juin au 31 mai', () => {
    expect(leavePeriod('2026-11-12')).toEqual({ start: '2026-06-01', end: '2027-05-31' })
    expect(leavePeriod('2027-03-01')).toEqual({ start: '2026-06-01', end: '2027-05-31' })
  })
})

describe('périodes refusées d’office', () => {
  it('Noël est bloqué', () => expect(blockedOn('2026-12-25')).toBe(true))
  it('le 10 janvier 2027 est encore bloqué', () => expect(blockedOn('2027-01-10')).toBe(true))
  it('les 11 et 12 janvier 2027 sont libres (décision de la RH)', () => {
    expect(blockedOn('2027-01-11')).toBe(false)
    expect(blockedOn('2027-01-12')).toBe(false)
  })
  it('les mêmes jours des autres années restent bloqués', () => {
    expect(blockedOn('2026-01-11')).toBe(true)
    expect(blockedOn('2028-01-12')).toBe(true)
  })
})

describe('demande de congés', () => {
  const base = { custom: [], apprentices: [], school: [] }
  it('une demande sur une période bloquée est refusée', () => {
    expect(evaluateLeaveRequest({ ...base, start: '2026-12-21', end: '2026-12-24' }).blocks.length).toBeGreaterThan(0)
  })
  it('une demande ordinaire est acceptée', () => {
    expect(evaluateLeaveRequest({ ...base, start: '2026-09-14', end: '2026-09-18' }).blocks).toEqual([])
  })
  it('le plafond de 5 semaines (25 jours) est contrôlé', () => {
    const ev = evaluateLeaveRequest({ ...base, start: '2026-09-14', end: '2026-09-18', cap: { limit: LEAVE_PERIOD_CAP_DAYS, used: 22, requested: 5 } })
    expect(ev.blocks.some(b => b.includes('Maximum 5 semaines'))).toBe(true)
  })
  it('apprenti à l’école plus de 3 jours dans la semaine → demande impossible', () => {
    const ev = evaluateLeaveRequest({
      ...base, start: '2026-09-14', end: '2026-09-18',
      apprentices: [{ id: 'a1', name: 'Léa BERNARD' }],
      school: [{ user_id: 'a1', start_date: '2026-09-14', end_date: '2026-09-18' }],
    })
    expect(ev.blocks.some(b => b.includes('école'))).toBe(true)
  })
})

describe('acquisition des congés', () => {
  it('mois écoulés depuis le 1er juin (mois en cours exclu)', () => expect(accruedMonths(null, '2026-11-12')).toBe(5))
  it('un entrant compte à partir de son mois d’entrée', () => expect(accruedMonths('2026-09-15', '2026-11-12')).toBe(2))
})
