import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyByPreference } from '@/lib/notify'
import { emailMention } from '@/emails/templates'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Notifie UNIQUEMENT les personnes explicitement mentionnées (@) dans un
// commentaire, et seulement celles qui ont activé la préférence « Mentions ».
export async function POST(request: NextRequest) {
  const { mentioned, comment, task, department, authorName } = await request.json()
  if (!mentioned?.length) return NextResponse.json({ sent: 0 })

  // Récupère la couleur de l'espace (le front n'envoie que le nom).
  const supabase = createAdminClient()
  let deptInfo = { name: department ?? '', color: '#E0596A' }
  if (department) {
    const { data } = await supabase
      .from('departments').select('name, color').eq('name', department).single()
    if (data) deptInfo = data
  }

  // Exclure l'auteur du commentaire (pas d'auto-notification).
  const actorId = getUserId()
  let actorEmail: string | undefined
  if (actorId) {
    const { data } = await supabase.from('profiles').select('email').eq('id', actorId).single()
    actorEmail = data?.email
  }

  let sent = 0
  for (const m of mentioned as { name: string; email: string }[]) {
    const tpl = emailMention({
      mentionedName: m.name.split(' ')[0],
      authorName,
      comment,
      task,
      department: deptInfo,
    })
    sent += await notifyByPreference({
      emails: [m.email],
      pref: 'notify_email_mentions',
      subject: tpl.subject,
      html: tpl.html,
      exclude: actorEmail ? [actorEmail] : [],
    })
  }
  return NextResponse.json({ sent })
}