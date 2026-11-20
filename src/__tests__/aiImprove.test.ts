import { describe, expect, it } from 'vitest'
import { sanitizeImprovement } from '@/lib/ai/improve'

describe('sanitizeImprovement', () => {
  it('nettoie et limite titre et description', () => {
    const r = sanitizeImprovement({ title: '  Envoyer le devis  ', description: ' - Appeler Mme Durand\n- Envoyer 3 modèles ' }, 'ancien')
    expect(r).toEqual({ title: 'Envoyer le devis', description: '- Appeler Mme Durand\n- Envoyer 3 modèles' })
  })
  it('garde le titre d’origine si l’IA n’en renvoie pas', () => expect(sanitizeImprovement({ title: '', description: 'x' }, 'Mon titre')?.title).toBe('Mon titre'))
  it('tronque les textes trop longs', () => expect(sanitizeImprovement({ title: 'a'.repeat(500), description: 'b'.repeat(9000) }, '')?.description.length).toBe(4000))
  it('refuse une réponse vide ou invalide', () => { expect(sanitizeImprovement(null, '')).toBeNull(); expect(sanitizeImprovement('texte', '')).toBeNull() })
})
