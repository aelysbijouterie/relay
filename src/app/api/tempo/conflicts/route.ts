import { NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Cartes dont les dates diffèrent de celles de Tempo : { conflicts: { [taskId]: "RELAYS : … · Tempo : …" } }.
// Répond « aucune » tant que la migration 034 n'est pas exécutée.
export async function GET() {
  if (!readSessionUserId()) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { data, error } = await createAdminClient().from('tempo_links').select('task_id, conflict').not('conflict', 'is', null)
  const conflicts: Record<string, string> = {}
  if (!error) for (const r of (data ?? []) as { task_id: string; conflict: string }[]) conflicts[r.task_id] = r.conflict
  return NextResponse.json({ conflicts }, { headers: { 'Cache-Control': 'no-store' } })
}
