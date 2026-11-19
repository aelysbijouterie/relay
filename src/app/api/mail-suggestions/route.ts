import { NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { createAdminClient } from '@/lib/supabase/server'
import { getMailOwner, runMailScan } from '@/lib/mail/pipeline'
import { imapConfig, testConnection } from '@/lib/mail/imap'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Réservé à la personne dont la boîte mail est lue.
async function ownerOnly() {
  const userId = readSessionUserId()
  if (!userId) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  const supabase = createAdminClient()
  const owner = await getMailOwner(supabase)
  if (!owner || owner.id !== userId) return { error: NextResponse.json({ error: 'Accès réservé' }, { status: 403 }) }
  return { supabase, owner }
}

export async function GET() {
  const g = await ownerOnly()
  if ('error' in g) return g.error
  const { data, error } = await g.supabase.from('mail_suggestions')
    .select('id, status, from_name, from_email, subject, received_at, title, description, priority, deadline, task_id')
    .eq('owner_id', g.owner.id).in('status', ['pending', 'created']).order('received_at', { ascending: false }).limit(200)
  return NextResponse.json({
    configured: { mail: !!imapConfig(), ai: !!process.env.GEMINI_API_KEY },
    auto: process.env.MAIL_AUTO_CREATE === 'true',
    items: error ? [] : data ?? [],
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// { action: 'test' } : vérifie la connexion à la boîte. { action: 'scan' } : lance l'analyse tout de suite.
export async function POST(request: Request) {
  const g = await ownerOnly()
  if ('error' in g) return g.error
  const body = await request.json().catch(() => ({}))
  if (body?.action === 'test') return NextResponse.json(await testConnection())
  if (body?.action === 'scan') return NextResponse.json(await runMailScan(g.supabase))
  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
