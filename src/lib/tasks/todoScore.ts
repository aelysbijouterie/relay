import type { Task } from '@/types'
import { effectiveDeadline } from './deadline'

// ─────────────────────────────────────────────────────────────────────────────
// Calcul de l'ordre "à traiter" d'une tâche (to-do priorisée).
// Règle métier (validée) : la DEADLINE prime (le retard d'abord), puis la
// PRIORITÉ, puis le STATUT (en cours avant à faire). Score élevé = à traiter
// en premier. 100% logique, aucun appel externe.
// ─────────────────────────────────────────────────────────────────────────────

export type UrgencyBucket =
  | 'retard'        // échéance dépassée
  | 'aujourdhui'    // échéance aujourd'hui
  | 'demain'        // échéance demain
  | 'cette_semaine' // échéance sous 7 jours
  | 'plus_tard'     // échéance > 7 jours
  | 'sans_date'     // pas d'échéance

const PRIORITY_WEIGHT: Record<string, number> = {
  'Urgent': 3, 'Élevée': 2, 'Moyenne': 1, 'Faible': 0,
}
const STATUS_WEIGHT: Record<string, number> = {
  'En cours': 2, 'A revoir': 2, 'Bloqué': 1, 'A Faire': 1, 'Terminé': -100, 'Archivé': -100,
}

// Nombre de jours entre aujourd'hui (minuit) et l'échéance. Négatif = en retard.
export function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(deadline); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

export function urgencyBucket(deadline: string | null): UrgencyBucket {
  const d = daysUntil(deadline)
  if (d === null) return 'sans_date'
  if (d < 0) return 'retard'
  if (d === 0) return 'aujourdhui'
  if (d === 1) return 'demain'
  if (d <= 7) return 'cette_semaine'
  return 'plus_tard'
}

// Poids de l'échéance — dominant, car « la deadline prime ».
// Le retard est d'autant plus fort qu'il est ancien.
function deadlineScore(deadline: string | null): number {
  const d = daysUntil(deadline)
  if (d === null) return 100               // sans date : milieu de tableau
  if (d < 0)  return 1000 + Math.min(-d, 60) * 5  // en retard : tout en haut
  if (d === 0) return 800                   // aujourd'hui
  if (d === 1) return 600                    // demain
  if (d <= 7) return 400 - d * 10            // cette semaine
  return 150 - Math.min(d, 60)               // plus tard
}

export function todoScore(task: Task): number {
  return deadlineScore(effectiveDeadline(task))
       + PRIORITY_WEIGHT[task.priority] * 30   // la priorité départage à deadline égale
       + (STATUS_WEIGHT[task.status] ?? 0) * 8 // le statut affine
}

// Trie une liste de tâches de la plus à traiter à la moins urgente.
export function sortTodo(tasks: Task[]): Task[] {
  return [...tasks]
    .filter(t => t.status !== 'Terminé' && t.status !== 'Archivé')
    .sort((a, b) => todoScore(b) - todoScore(a))
}

// ── Focus du jour ────────────────────────────────────────────────────────────
// Sélectionne les N tâches à traiter aujourd'hui, dans l'ordre :
//  1. les retards (urgence absolue)
//  2. les échéances proches (aujourd'hui → cette semaine)
//  3. pour compléter : le « reste » classé par sous-tâches —
//     d'abord les presque finies (à boucler vite), puis les gros chantiers.
// La pondération sous-tâches ne s'applique QU'AU reste, pas aux urgences.

// Nombre de sous-tâches restantes (non terminées) d'une tâche.
export function remainingSubtasks(task: Task): number {
  const subs = task.subtasks ?? []
  if (subs.length === 0) return 0
  return subs.filter(s => s.status !== 'Terminé').length
}

function isUrgentBucket(b: UrgencyBucket): boolean {
  return b === 'retard' || b === 'aujourdhui' || b === 'demain' || b === 'cette_semaine'
}

export function focusOfDay(tasks: Task[], limit = 6): Task[] {
  const active = tasks.filter(t => t.status !== 'Terminé' && t.status !== 'Archivé')

  // 1+2. Les urgentes (retard + échéances proches), triées par score.
  const urgent = active
    .filter(t => isUrgentBucket(urgencyBucket(effectiveDeadline(t))))
    .sort((a, b) => todoScore(b) - todoScore(a))

  // 3. Le reste (pas d'urgence forte), trié par sous-tâches :
  //    presque finies d'abord (peu de restantes > 0), puis gros chantiers,
  //    et les tâches sans sous-tâches en dernier.
  const rest = active
    .filter(t => !isUrgentBucket(urgencyBucket(effectiveDeadline(t))))
    .sort((a, b) => {
      const ra = remainingSubtasks(a)
      const rb = remainingSubtasks(b)
      const aHas = ra > 0, bHas = rb > 0
      if (aHas && bHas) {
        // les deux ont des sous-tâches restantes : on les classe par
        // "presque finies d'abord" → écart au plus petit nombre restant.
        // Si même nombre, on départage par priorité/score.
        if (ra !== rb) {
          // presque finie = petit nombre ; mais on veut presque-finies AVANT
          // gros chantiers → ascendant sur le restant.
          // Sauf 1 restante qui est la plus "bouclable" : reste ascendant OK.
          return ra - rb
        }
        return todoScore(b) - todoScore(a)
      }
      if (aHas !== bHas) return aHas ? -1 : 1   // celles avec sous-tâches avant celles sans
      return todoScore(b) - todoScore(a)         // aucune sous-tâche : par score
    })

  return [...urgent, ...rest].slice(0, limit)
}

// Libellé court d'urgence pour l'affichage.
export function urgencyLabel(deadline: string | null): { text: string; tone: 'red' | 'orange' | 'blue' | 'gray' } {
  const b = urgencyBucket(deadline)
  switch (b) {
    case 'retard':        { const d = daysUntil(deadline)!; return { text: `En retard de ${-d} j`, tone: 'red' } }
    case 'aujourdhui':    return { text: "Aujourd'hui", tone: 'red' }
    case 'demain':        return { text: 'Demain', tone: 'orange' }
    case 'cette_semaine': { const d = daysUntil(deadline)!; return { text: `Dans ${d} j`, tone: 'orange' } }
    case 'plus_tard':     { const d = daysUntil(deadline)!; return { text: `Dans ${d} j`, tone: 'blue' } }
    case 'sans_date':     return { text: 'Pas de date', tone: 'gray' }
  }
}
