import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runMailScan } from '@/lib/mail/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function parisHour(): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date())
  return Number(parts.find(p => p.type === 'hour')?.value ?? -1)
}

// Chaque jour à 08:00 (heure de Paris) : lecture de la boîte mail, analyse, propositions de cartes.
// Programmé à 06:00 ET 07:00 UTC (vercel.json) ; seul le passage qui tombe à 08 h à Paris travaille (heure d'été / d'hiver).
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const force = new URL(request.url).searchParams.get('force') === '1'
  const hour = parisHour()
  if (!force && hour !== 8) return NextResponse.json({ skipped: true, reason: 'pas 08 h à Paris', hour })
  const result = await runMailScan(createAdminClient())
  return NextResponse.json(result)
}
