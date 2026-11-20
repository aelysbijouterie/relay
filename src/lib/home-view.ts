// Vue favorite : la page sur laquelle RELAYS s'ouvre toujours (réglage du profil).
// Mémorisée dans un cookie lisible (non sensible) pour fonctionner partout, y compris dans le middleware.
export const HOME_COOKIE = 'relays-home'
export const HOME_VIEWS = [
  { href: '/kanban', label: 'Kanban' },
  { href: '/calendrier', label: 'Calendrier' },
  { href: '/ma-todo', label: 'Focus du jour' },
  { href: '/timeline', label: 'Chronologie' },
  { href: '/pac-media-kit', label: 'Opérations & Média Kit' },
  { href: '/conges', label: 'Congés & absences' },
] as const

export function sanitizeHome(v?: string | null): string {
  return HOME_VIEWS.some(h => h.href === v) ? (v as string) : '/kanban'
}

export function readHomeClient(): string {
  try {
    const m = document.cookie.split('; ').find(c => c.startsWith(HOME_COOKIE + '='))
    return sanitizeHome(m ? decodeURIComponent(m.split('=')[1]) : null)
  } catch { return '/kanban' }
}

export function writeHomeClient(href: string) {
  document.cookie = `${HOME_COOKIE}=${encodeURIComponent(sanitizeHome(href))}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax; secure`
}
