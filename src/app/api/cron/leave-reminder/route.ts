import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendRhDigest } from '@/lib/absences/rhMail'

export const dynamic = 'force-dynamic'

// Jour et heure à Paris (les crons Vercel sont en UTC : l'heure d'été / d'hiver décale d'une heure).
function parisNow(): { weekday: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'long', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date())
  return {
    weekday: parts.find(p => p.type === 'weekday')?.value ?? '',
    hour: Number(parts.find(p => p.type === 'hour')?.value ?? -1),
  }
}

// Récapitulatif du LUNDI 09:00 (heure de Paris) à la RH validatrice : toutes les demandes de congés des boutiques
// encore en attente, avec le détail utile à la décision. Programmé à 07:00 ET 08:00 UTC (vercel.json) ; seul le passage
// qui tombe à 09 h à Paris envoie le mail. Aucun mail s'il n'y a rien à traiter. Jamais soumis aux préférences.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const force = new URL(request.url).searchParams.get('force') === '1'
  const { weekday, hour } = parisNow()
  if (!force && !(weekday === 'Monday' && hour === 9)) {
    return NextResponse.json({ skipped: true, reason: 'pas lundi 09 h à Paris', weekday, hour })
  }
  const result = await sendRhDigest(createAdminClient())
  return NextResponse.json(result)
}
