/** Nettoie la réponse de l'IA (jamais de confiance aveugle). */
export function sanitizeImprovement(raw: unknown, fallbackTitle: string): { title: string; description: string } | null {
  const o = raw as { title?: unknown; description?: unknown } | null
  const description = typeof o?.description === 'string' ? o.description.trim().slice(0, 4000) : ''
  const title = typeof o?.title === 'string' && o.title.trim() ? o.title.trim().slice(0, 150) : fallbackTitle.slice(0, 150)
  if (!description && !title) return null
  return { title, description }
}
