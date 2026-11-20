import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runMailScan } from '@/lib/mail/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function parisTime(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date())
  return { hour: Number(parts.find(p => p.type === 'hour')?.value ?? -1), minute: Number(parts.find(p => p.type === 'minute')?.value ?? -1) }
}

// Toutes les heures (vercel.json, en UTC : une entrée par heure car l'offre Vercel Hobby limite chaque tâche à une exécution par jour) : lecture de la boîte mail, cartes créées / avancées automatiquement.
// Seuls les passages entre 07 h et 20 h (heure de Paris) travaillent ; le récapitulatif par e-mail part une seule fois par jour, au premier passage à partir de 08 h (mémorisé dans la base).
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const force = new URL(request.url).searchParams.get('force') === '1'
  const { hour } = parisTime()
  if (!force && (hour < 7 || hour > 19)) return NextResponse.json({ skipped: true, reason: 'hors 07 h–20 h à Paris', hour })
  const result = await runMailScan(createAdminClient(), { digest: hour >= 8 })
  return NextResponse.json(result)
}
