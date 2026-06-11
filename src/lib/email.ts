import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY ?? 'placeholder')
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
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('placeholder')) {
    console.log('[email] clé manquante — email non envoyé à', to)
    return
  }

  // Si RESEND_TEST_EMAIL est défini, tous les emails sont redirigés vers cette adresse
  const destination = process.env.RESEND_TEST_EMAIL
    ? [process.env.RESEND_TEST_EMAIL]
    : Array.isArray(to) ? to : [to]

  try {
    await resend.emails.send({ from: FROM, to: destination, subject, html })
    console.log('[email] envoyé à', destination, '—', subject)
  } catch (err) {
    console.error('[email] erreur envoi:', err)
  }
}
