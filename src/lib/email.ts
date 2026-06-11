import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL ?? 'RELAYS <onboarding@resend.dev>'

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[]
  subject: string
  html: string
}) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_XXX')) {
    console.log('[email] clé manquante — email non envoyé à', to)
    return
  }
  try {
    await resend.emails.send({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html })
  } catch (err) {
    console.error('[email] erreur envoi:', err)
  }
}
