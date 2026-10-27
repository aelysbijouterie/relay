import nodemailer from 'nodemailer'
import { createAdminClient } from '@/lib/supabase/server'

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

// ── Verrou « boutiques » ─────────────────────────────────────────────────────
// Tant que BOUTIQUES_EMAILS_ENABLED n'est pas « true » (Vercel), AUCUN e-mail
// n'est envoyé aux boutiques : ni aux comptes de magasin, ni à leurs
// collaborateurs, ni aux adresses des magasins. Ce filtre est appliqué ici,
// au point de passage unique, donc il couvre les crons, les assignations de
// cartes, les congés et les invitations. En cas de doute (erreur de lecture),
// on n'envoie PAS.
// Ne couvre pas les e-mails d'authentification envoyés par Supabase (réinitialisation de mot de passe).
async function removeBoutiqueRecipients(recipients: string[]): Promise<string[]> {
  if (process.env.BOUTIQUES_EMAILS_ENABLED === 'true') return recipients
  try {
    const supabase = createAdminClient()
    const [profiles, shops] = await Promise.all([
      supabase.from('profiles').select('email').not('boutique_id', 'is', null),
      supabase.from('boutiques').select('email'),
    ])
    if (profiles.error || shops.error) throw new Error('lecture boutiques impossible')
    const blocked = new Set([...(profiles.data ?? []), ...(shops.data ?? [])]
      .map(r => (r.email as string | null)?.trim().toLowerCase()).filter((e): e is string => !!e))
    const kept = recipients.filter(r => !blocked.has(r.trim().toLowerCase()) && !r.trim().toLowerCase().endsWith('.invalid'))
    if (kept.length < recipients.length) console.log('[email] destinataires boutiques ignorés (verrou actif)')
    return kept
  } catch (err) {
    console.error('[email] verrou boutiques : envoi annulé par prudence', err)
    return []
  }
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

  // Les boutiques sont filtrées AVANT toute redirection de test.
  const allowed = await removeBoutiqueRecipients(Array.isArray(to) ? to : [to])
  if (allowed.length === 0) return

  // Redirection de test : si SMTP_TEST_EMAIL est défini, tout part vers cette
  // adresse au lieu des vrais destinataires.
  const destination = process.env.SMTP_TEST_EMAIL
    ? [process.env.SMTP_TEST_EMAIL]
    : allowed

  try {
    await tx.sendMail({ from: FROM, to: destination, subject, html })
    console.log('[email] envoyé à', destination, '—', subject)
  } catch (err) {
    console.error('[email] erreur envoi:', err)
  }
}