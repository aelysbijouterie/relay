import { describe, it, expect } from 'vitest'
import { farOperationCutoff, isFarOperation } from '@/lib/tasks/farOperation'

const now = new Date(2026, 10, 24) // 24 novembre 2026
describe('farOperation', () => {
  it('limite = aujourd’hui + 3 mois', () => {
    expect(farOperationCutoff(now)).toBe('2027-02-24')
    expect(farOperationCutoff(new Date(2026, 10, 30))).toBe('2027-02-28')
  })
  it('masque les opérations qui démarrent dans plus de 3 mois', () => {
    expect(isFarOperation({ op_category: 'operation_commerciale', op_date_debut: '2027-03-01' }, now)).toBe(true)
    expect(isFarOperation({ op_category: 'operation_commerciale', op_date_debut: '2027-02-03' }, now)).toBe(false)
    expect(isFarOperation({ op_category: 'operation_commerciale', op_date_debut: '2026-12-28' }, now)).toBe(false)
  })
  it('ne touche ni les autres cartes ni les opérations sans date', () => {
    expect(isFarOperation({ op_category: null, op_date_debut: '2027-09-01' }, now)).toBe(false)
    expect(isFarOperation({ op_category: 'media_kit', op_date_debut: '2027-09-01' }, now)).toBe(false)
    expect(isFarOperation({ op_category: 'operation_commerciale', op_date_debut: null }, now)).toBe(false)
  })
})
