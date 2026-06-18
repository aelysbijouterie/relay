import nodemailer from 'nodemailer'

// ── Envoi d'emails via SMTP OVH ──────────────────────────────────────────────
// On utilise la messagerie OVH d'Aelys (@aelys.fr) plutôt qu'un service tiers,
// ce qui évite d'avoir à vérifier un domaine via un prestataire DNS.
//
// Variables d'environnement attendues (à définir en local ET dans Vercel) :
//   SMTP_HOST     = ssl0.ovh.net
//   SMTP_PORT     = 587
//   SMTP_USER     = notifications@aelys.fr   (adresse complète de la boîte)
//   SMTP_PASSWORD = (mot de passe de la boîte OVH)
//   SMTP_FROM     = RELAYS <notifications@aelys.fr>   (optionnel ; défaut = SMTP_USER)
//   SMTP_TEST_EMAIL = (optionnel) si défini, TOUS les emails vont vers cette
//                     adresse — pratique pour tester sans spammer l'équipe.
//                     À NE PAS définir en production.

const HOST = process.env.SMTP_HOST ?? 'ssl0.ovh.net'
const PORT = Number(process.env.SMTP_PORT ?? '587')
const USER = process.env.SMTP_USER
const PASS = process.env.SMTP_PASSWORD
const FROM = process.env.SMTP_FROM ?? (USER ? `RELAYS <${USER}>` : 'RELAYS')

// Le transporteur est créé une seule fois et réutilisé.
let transporter: nodemailer.Transporter | null = null
function getTransporter(): nodemailer.Transporter | null {
  if (!USER || !PASS) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465, // 465 = SSL ; 587 = STARTTLS (secure:false + upgrade auto)
      auth: { user: USER, pass: PASS },
    })
  }
  return transporter
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[]
  subject: string
  html: string
}) {
  const tx = getTransporter()
  if (!tx) {
    console.log('[email] identifiants SMTP manquants — email non envoyé à', to)
    return
  }

  // Redirection de test : si SMTP_TEST_EMAIL est défini, tout part vers cette
  // adresse au lieu des vrais destinataires.
  const destination = process.env.SMTP_TEST_EMAIL
    ? [process.env.SMTP_TEST_EMAIL]
    : Array.isArray(to) ? to : [to]

  try {
    await tx.sendMail({ from: FROM, to: destination, subject, html })
    console.log('[email] envoyé à', destination, '—', subject)
  } catch (err) {
    console.error('[email] erreur envoi:', err)
  }
}