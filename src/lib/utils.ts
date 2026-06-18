import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDeadline(deadline: string | null): string {
  if (!deadline) return ''
  const date = parseISO(deadline)
  if (isToday(date)) return "Aujourd'hui"
  if (isTomorrow(date)) return 'Demain'
  return format(date, 'd MMM', { locale: fr })
}

export function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false
  return isPast(parseISO(deadline)) && !isToday(parseISO(deadline))
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
// Libellé affiché d'un rôle (manager → Responsable pour l'affichage).
export function roleLabel(role?: string): string {
  switch (role) {
    case 'admin':         return 'Admin'
    case 'manager':       return 'Responsable'
    case 'collaborateur': return 'Collaborateur'
    default:              return role ?? ''
  }
}