import type { createAdminClient } from '@/lib/supabase/server'
import { notifyByPreference } from '@/lib/notify'
import { baseHtml } from '@/emails/baseHtml'

interface Input {
  supabase: ReturnType<typeof createAdminClient>
  creatorId: string
  userIds: string[]
  title: string
  date: string
  time: string | null
  note: string | null
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Invitation par e-mail des personnes ajoutées à un événement (respecte la
 * préférence « assignation » de chacune). Ne bloque jamais l'enregistrement.
 */
export async function notifyAttendees({ supabase, creatorId, userIds, title, date, time, note }: Input): Promise<void> {
  if (userIds.length === 0) return
  try {
    const [{ data: people }, { data: creator }] = await Promise.all([
      supabase.from('profiles').select('email').in('id', userIds),
      supabase.from('profiles').select('name, department:departments!department_id(color)').eq('id', creatorId).single(),
    ])
    const emails = (people ?? []).map(p => p.email as string).filter(e => !!e && !e.endsWith('.invalid'))
    if (emails.length === 0) return

    const dept = Array.isArray(creator?.department) ? creator?.department[0] : creator?.department
    const color = (dept as { color?: string } | null | undefined)?.color ?? '#3B82F6'
    const when = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      + (time ? ` à ${time.slice(0, 5)}` : '')
    const who = escapeHtml(creator?.name ?? 'Un collègue')

    const html = baseHtml({
      title: 'Invitation à un événement',
      preheader: `${creator?.name ?? 'Un collègue'} vous invite : ${title}`,
      deptColor: color,
      content: `
        <h2 style="margin:0 0 10px;font-size:21px;font-weight:700;color:#1C1E26;">Vous êtes invité(e)</h2>
        <p style="margin:0 0 18px;color:#5A6072;font-size:14.5px;line-height:1.6;"><strong>${who}</strong> vous a ajouté(e) à un événement de son calendrier :</p>
        <div style="background:#F9FAFB;border-left:4px solid ${color};border-radius:0 10px 10px 0;padding:15px 18px;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#1C1E26;">${escapeHtml(title)}</p>
          <p style="margin:6px 0 0;font-size:13px;color:#6A7180;text-transform:capitalize;">${when}</p>
          ${note ? `<p style="margin:8px 0 0;font-size:13px;color:#6A7180;white-space:pre-wrap;">${escapeHtml(note)}</p>` : ''}
        </div>
        <p style="margin:16px 0 0;color:#6A7180;font-size:13px;">Il apparaît dans votre calendrier RELAYS.</p>
      `,
    })
    await notifyByPreference({ emails, pref: 'notify_email_assigned', subject: `📅 Invitation — ${title}`, html })
  } catch { /* l'invitation est un plus : on ne fait jamais échouer l'enregistrement */ }
}
