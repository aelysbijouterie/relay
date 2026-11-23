import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { runTempoSync } from '@/lib/tempo/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a); const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

// Appelé par Tempo (secret partagé) dès qu'une opération est créée, modifiée, validée ou qu'un mail part : synchronisation immédiate.
export async function POST(request: NextRequest) {
  const secret = process.env.TEMPO_SYNC_SECRET
  const auth = request.headers.get('authorization') ?? ''
  if (!secret || !sameSecret(auth, `Bearer ${secret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { return NextResponse.json(await runTempoSync(createAdminClient())) }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Erreur interne' }) }
}
