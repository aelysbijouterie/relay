import { NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { createAdminClient } from '@/lib/supabase/server'
import { runTempoSync } from '@/lib/tempo/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Bouton « Synchroniser avec Tempo » et envoi immédiat après la création d'une carte opération.
export async function POST() {
  if (!readSessionUserId()) return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 })
  try { return NextResponse.json(await runTempoSync(createAdminClient())) }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Erreur interne' }) }
}
