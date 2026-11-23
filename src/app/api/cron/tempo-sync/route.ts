import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runTempoSync } from '@/lib/tempo/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Toutes les heures (vercel.json : une entrée par heure, offre Hobby) : synchronisation RELAYS ⇄ Tempo.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try { return NextResponse.json(await runTempoSync(createAdminClient())) }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Erreur interne' }) }
}
