'use client'

import useSWR from 'swr'

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : { conflicts: {} }))

/** Cartes dont les dates diffèrent de celles de Tempo ({ idCarte: texte }). Vide tant que la liaison n'est pas installée. */
export function useTempoConflicts(): Record<string, string> {
  const { data } = useSWR<{ conflicts: Record<string, string> }>('/api/tempo/conflicts', fetcher, { refreshInterval: 60000, revalidateOnFocus: true })
  return data?.conflicts ?? {}
}
