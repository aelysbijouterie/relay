import type { TempoOperation } from './logic'

// Appels vers Tempo (https://pac-aelys.vercel.app). Accès protégé par un secret partagé (TEMPO_SYNC_SECRET ici,
// RELAYS_SYNC_SECRET côté Tempo : même valeur). RELAYS ne modifie jamais les dates ni les étapes de Tempo,
// il lui transmet seulement : la création d'une opération, le lien avec la carte, ses propres dates et l'éventuelle dissonance.

export function tempoConfig() {
  const url = (process.env.TEMPO_URL || '').replace(/\/+$/, '')
  const secret = process.env.TEMPO_SYNC_SECRET
  return url && secret ? { url, secret } : null
}

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const cfg = tempoConfig()
  if (!cfg) throw new Error('Liaison Tempo non configurée (TEMPO_URL / TEMPO_SYNC_SECRET dans Vercel)')
  const r = await fetch(`${cfg.url}${path}`, {
    ...init, cache: 'no-store', signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.secret}`, ...(init.headers ?? {}) },
  })
  if (!r.ok) throw new Error(`Tempo a répondu ${r.status}${r.status === 404 ? ' (la liaison n’est pas encore installée côté Tempo)' : r.status === 401 ? ' (secret refusé)' : ''}`)
  return r.json()
}

export async function listTempoOperations(): Promise<TempoOperation[]> {
  const j = await call('/api/sync/operations') as { operations?: TempoOperation[] } | TempoOperation[]
  return Array.isArray(j) ? j : (j.operations ?? [])
}

export interface TempoUpsert {
  relays_task_id: string
  /** Opération déjà liée : Tempo ne change alors NI son nom NI ses dates, il enregistre seulement les infos RELAYS ci-dessous. */
  tempo_operation_id?: string
  nom: string
  date_debut: string | null
  date_fin: string | null
  mecanique: string | null
  /** Dates saisies dans RELAYS + texte de dissonance (null = tout est d'accord) : Tempo les affiche en rouge si besoin. */
  relays: { date_debut: string | null; date_fin: string | null; conflit: string | null }
  /** Demande à Tempo de retirer le lien avec cette carte (liée par erreur à une autre édition) : relays_task_id, dates et alerte effacés. */
  delier?: boolean
}

export async function upsertTempoOperation(p: TempoUpsert): Promise<{ id: string }> {
  const j = await call('/api/sync/operations', { method: 'POST', body: JSON.stringify(p) }) as { id?: string; operation?: { id?: string } }
  const id = j.id ?? j.operation?.id
  if (!id) throw new Error('Tempo n’a pas renvoyé l’identifiant de l’opération')
  return { id: String(id) }
}
