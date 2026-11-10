import type { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { baseHtml, button } from '@/emails/baseHtml'
import { countWorkdays, boutiqueDayOptions } from '@/lib/absences/workdays'
import { leavePeriod, LEAVE_PERIOD_CAP_DAYS } from '@/lib/absences/leaveRules'
import { evaluateForBoutique } from '@/lib/absences/leaveRulesServer'
import type { AbsencePeriod } from '@/types/absences'

type Admin = ReturnType<typeof createAdminClient>

export type RhMailKind = 'new' | 'modification' | 'info' | 'reminder48' | 'reminder72'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aelys-relays.vercel.app'
const RH_COLOR = '#3E8FCC'
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
const day = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
const short = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const periodLabel = (p: AbsencePeriod | null | undefined) => (p === 'am' ? ' (matin)' : p === 'pm' ? ' (après-midi)' : '')
const overlaps = (aS: string, aE: string, bS: string, bE: string) => aS <= bE && aE >= bS

/** Personnes qui valident les boutiques : elles reçoivent TOUJOURS ces e-mails (aucune préférence ne les désactive). */
export async function getRhRecipients(supabase: Admin): Promise<string[]> {
  const { data } = await supabase.from('profiles').select('email').eq('can_validate_boutiques', true)
  return (data ?? []).map(p => p.email as string).filter(Boolean)
}

export interface RequestInfo {
  id: string
  type: string
  status: string
  modification: boolean
  reason: string | null
  createdAt: string
  waitingSince: string
  waitingHours: number
  who: { name: string; contract: string | null; hireDate: string | null; cadre: boolean }
  shop: { code: number | string | null; name: string; city: string | null; responsable: string | null }
  range: { start: string; end: string; sp: AbsencePeriod; ep: AbsencePeriod }
  oldRange: { start: string; end: string; sp: AbsencePeriod; ep: AbsencePeriod } | null
  days: number
  oldDays: number | null
  balance: null | {
    label: string; acquired: number; split: number; acquiring: number | null; taken: number
    pendingOthers: number; before: number; after: number
    cap: { used: number; limit: number } | null
  }
  warnings: string[]
  blocks: string[]
  overlapsShop: { name: string; type: string; start: string; end: string; status: string }[]
  operations: { title: string; mecanique: string | null; start: string | null; end: string | null }[]
  otherPending: { type: string; start: string; end: string }[]
}

type Rel<T> = T | T[] | null | undefined
const one = <T,>(v: Rel<T>): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined)

/** Rassemble le maximum d'informations utiles pour décider d'une demande de congés de boutique. */
export async function loadRequestInfo(supabase: Admin, absenceId: string): Promise<RequestInfo | null> {
  const { data: a } = await supabase.from('absences').select(`
      id, user_id, type, start_date, end_date, start_period, end_period, reason, status, created_at,
      pending_start_date, pending_end_date, pending_start_period, pending_end_period,
      user:profiles!user_id(id, name, boutique_id, contract_type, hire_date, is_cadre,
        leave_balance_conges, leave_balance_rtt, leave_balance_since, leave_acquiring, leave_split_days, leave_taken_period,
        boutique:boutiques!boutique_id(id, code, name, city, responsable))
    `).eq('id', absenceId).single()
  if (!a) return null
  const u = one(a.user as Rel<Record<string, unknown>>) as Record<string, unknown> | undefined
  const shop = one(u?.boutique as Rel<Record<string, unknown>>) as Record<string, unknown> | undefined
  if (!u || !shop) return null

  const modification = a.status === 'Modif. en attente' && !!a.pending_start_date
  const sp0 = ((a.start_period as AbsencePeriod) ?? 'full'), ep0 = ((a.end_period as AbsencePeriod) ?? 'full')
  const oldRange = modification ? { start: a.start_date as string, end: a.end_date as string, sp: sp0, ep: ep0 } : null
  const range = modification
    ? { start: a.pending_start_date as string, end: (a.pending_end_date ?? a.pending_start_date) as string,
        sp: ((a.pending_start_period as AbsencePeriod) ?? 'full'), ep: ((a.pending_end_period as AbsencePeriod) ?? 'full') }
    : { start: a.start_date as string, end: a.end_date as string, sp: sp0, ep: ep0 }
  const type = a.type as string
  const opts = boutiqueDayOptions(type)
  const days = countWorkdays(range.start, range.end, range.sp, range.ep, opts)
  const oldDays = oldRange ? countWorkdays(oldRange.start, oldRange.end, oldRange.sp, oldRange.ep, opts) : null
  const userId = u.id as string, boutiqueId = u.boutique_id as string

  // Début de l'attente (colonnes de la migration 030 : lecture tolérante)
  let waitingSince = a.created_at as string
  try {
    const { data: w, error } = await supabase.from('absences').select('rh_pending_since').eq('id', absenceId).single()
    if (!error && w?.rh_pending_since) waitingSince = w.rh_pending_since as string
  } catch { /* migration 030 pas encore passée */ }

  // Autres demandes du collaborateur
  const { data: mine } = await supabase.from('absences')
    .select('id, type, start_date, end_date, start_period, end_period, status')
    .eq('user_id', userId).neq('id', absenceId).neq('status', 'Refusé')
  const mineRows = (mine ?? []) as { id: string; type: string; start_date: string; end_date: string; start_period: AbsencePeriod; end_period: AbsencePeriod; status: string }[]
  const isPend = (s: string) => s === 'En attente' || s === 'Modif. en attente'
  const otherPending = mineRows.filter(r => isPend(r.status)).map(r => ({ type: r.type, start: r.start_date, end: r.end_date }))

  // Soldes
  let balance: RequestInfo['balance'] = null
  const isCp = type === 'Congés payés', isRtt = type === 'RTT'
  if (isCp || isRtt) {
    const sameType = mineRows.filter(r => r.type === type)
    const since = (u.leave_balance_since as string | null) ?? `${new Date().getFullYear()}-01-01`
    const taken = sameType.filter(r => r.status === 'Validé' && r.start_date >= since)
      .reduce((s, r) => s + countWorkdays(r.start_date, r.end_date, r.start_period, r.end_period, opts), 0)
    const pendingOthers = sameType.filter(r => isPend(r.status))
      .reduce((s, r) => s + countWorkdays(r.start_date, r.end_date, r.start_period, r.end_period, opts), 0)
    const acquired = Number((isCp ? u.leave_balance_conges : u.leave_balance_rtt) ?? 0)
    const split = isCp ? Number(u.leave_split_days ?? 0) : 0
    const before = acquired + split - taken - pendingOthers
    let cap: { used: number; limit: number } | null = null
    if (isCp) {
      const period = leavePeriod(range.start)
      let used = sameType.filter(r => r.start_date >= period.start && r.start_date <= period.end)
        .reduce((s, r) => s + countWorkdays(r.start_date, r.end_date, r.start_period, r.end_period, opts), 0)
      if (leavePeriod(new Date().toISOString().slice(0, 10)).start === period.start) used += Number(u.leave_taken_period ?? 0)
      cap = { used: used + days, limit: LEAVE_PERIOD_CAP_DAYS }
    }
    balance = {
      label: isCp ? 'Congés payés' : 'RTT', acquired, split, acquiring: isCp ? Number(u.leave_acquiring ?? 0) : null,
      taken, pendingOthers, before, after: before - days, cap,
    }
  }

  // Règles de pose (avertissements, éventuels blocages) — mêmes règles que la saisie en boutique
  let warnings: string[] = [], blocks: string[] = []
  if (isCp || isRtt) {
    try {
      const ev = await evaluateForBoutique(supabase, boutiqueId, range.start, range.end, {
        memberId: userId, startPeriod: range.sp, endPeriod: range.ep, excludeAbsenceId: absenceId, applyCap: isCp,
      })
      warnings = ev.warnings; blocks = ev.blocks
    } catch { /* informations seulement */ }
  }

  // Collègues du magasin absents sur les mêmes dates
  const { data: others } = await supabase.from('absences')
    .select('type, start_date, end_date, status, user:profiles!user_id(name, boutique_id)')
    .neq('user_id', userId).neq('status', 'Refusé').lte('start_date', range.end).gte('end_date', range.start)
  const overlapsShop = (others ?? []).flatMap((o: Record<string, unknown>) => {
    const ou = one(o.user as Rel<{ name: string; boutique_id: string | null }>)
    if (!ou || ou.boutique_id !== boutiqueId) return []
    return [{ name: ou.name, type: o.type as string, start: o.start_date as string, end: o.end_date as string, status: o.status as string }]
  })

  // Opérations commerciales sur la période
  let operations: RequestInfo['operations'] = []
  if (isCp || isRtt) {
    const { data: ops } = await supabase.from('tasks')
      .select('title, op_date_debut, op_date_fin, op_mecanique').eq('op_category', 'operation_commerciale').is('deleted_at', null)
    operations = (ops ?? []).flatMap(o => {
      const end = (o.op_date_fin ?? o.op_date_debut) as string | null
      const start = (o.op_date_debut ?? end) as string | null
      if (!start || !end || !overlaps(start.slice(0, 10), end.slice(0, 10), range.start, range.end)) return []
      return [{ title: o.title as string, mecanique: (o.op_mecanique as string | null) ?? null, start: start.slice(0, 10), end: end.slice(0, 10) }]
    })
  }

  return {
    id: absenceId, type, status: a.status as string, modification, reason: (a.reason as string | null) ?? null,
    createdAt: a.created_at as string, waitingSince, waitingHours: Math.max(0, (Date.now() - new Date(waitingSince).getTime()) / 3600000),
    who: { name: u.name as string, contract: (u.contract_type as string | null) ?? null, hireDate: (u.hire_date as string | null) ?? null, cadre: u.is_cadre === true },
    shop: { code: (shop.code as number | string | null) ?? null, name: shop.name as string, city: (shop.city as string | null) ?? null, responsable: (shop.responsable as string | null) ?? null },
    range, oldRange, days, oldDays, balance, warnings, blocks, overlapsShop, operations, otherPending,
  }
}

function waitingText(h: number): string {
  if (h < 1) return 'moins d\'une heure'
  if (h < 48) return `${Math.floor(h)} h`
  const d = Math.floor(h / 24)
  return `${d} jour${d > 1 ? 's' : ''} (${Math.floor(h)} h)`
}
const rangeText = (r: { start: string; end: string; sp: AbsencePeriod; ep: AbsencePeriod }) =>
  r.start === r.end ? `${day(r.start)}${periodLabel(r.sp)}` : `${day(r.start)}${periodLabel(r.sp)} → ${day(r.end)}${periodLabel(r.ep)}`

const KIND_META: Record<RhMailKind, { emoji: string; label: string; color: string; title: string }> = {
  new:          { emoji: '🗓️', label: 'Congés à valider',                color: RH_COLOR,  title: 'Nouvelle demande de congés à valider' },
  modification: { emoji: '✏️', label: 'Modification à valider',          color: '#7E6FB0', title: 'Demande de modification à valider' },
  info:         { emoji: '🩺', label: 'Absence signalée',                color: '#64748B', title: 'Absence signalée par une boutique' },
  reminder48:   { emoji: '⏰', label: 'Rappel 48 h — toujours en attente', color: '#D97706', title: 'Rappel : demande en attente depuis 48 h' },
  reminder72:   { emoji: '🚨', label: 'Rappel 72 h — urgent',            color: '#DC2626', title: 'Rappel urgent : demande en attente depuis 72 h' },
}

const row = (k: string, v: string) =>
  `<tr><td style="padding:5px 12px 5px 0;color:#6A7180;font-size:13px;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:5px 0;color:#1C1E26;font-size:13.5px;font-weight:600;">${v}</td></tr>`
const section = (title: string, inner: string, color = '#9AA0AE') =>
  `<p style="margin:18px 0 6px;font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${color};">${title}</p>${inner}`
const table = (rows: string) => `<table cellpadding="0" cellspacing="0" style="width:100%;">${rows}</table>`
const bullet = (items: string[], color: string) =>
  `<ul style="margin:0;padding-left:18px;color:${color};font-size:13.5px;line-height:1.55;">${items.map(i => `<li style="margin:0 0 3px;">${i}</li>`).join('')}</ul>`

export function requestSubject(i: RequestInfo, kind: RhMailKind): string {
  const m = KIND_META[kind]
  const where = `${i.who.name} (${i.shop.name})`
  const dates = i.range.start === i.range.end ? short(i.range.start) : `${short(i.range.start)} → ${short(i.range.end)}`
  const emoji = kind === 'info' && i.type === 'Alternance' ? '🎓' : m.emoji
  const head = kind === 'info' ? `${i.type === 'Alternance' ? 'Alternance enregistrée' : 'Absence signalée'}` : m.label
  return `${emoji} ${head} — ${where} · ${dates}${kind === 'info' ? '' : ` · ${num(i.days)} j`}`
}

export function requestHtml(i: RequestInfo, kind: RhMailKind): string {
  const m = KIND_META[kind]
  const urgent = kind === 'reminder48' || kind === 'reminder72'
  const link = `${APP_URL}/conges/rh?focus=${i.id}`

  const banner = urgent
    ? `<div style="background:${m.color}14;border:1px solid ${m.color}55;border-radius:10px;padding:12px 16px;margin:0 0 18px;"><p style="margin:0;font-size:14px;font-weight:700;color:${m.color};">${esc(m.label)}</p><p style="margin:4px 0 0;font-size:13px;color:#5A6072;">Cette demande attend votre validation depuis ${esc(waitingText(i.waitingHours))}. Le magasin ne sait pas encore s'il peut s'organiser.</p></div>`
    : ''

  const who = table(
    row('Collaborateur', esc(i.who.name)) +
    row('Magasin', `${i.shop.code != null ? `n° ${esc(i.shop.code)} · ` : ''}${esc(i.shop.name)}${i.shop.city ? ` (${esc(i.shop.city)})` : ''}`) +
    (i.shop.responsable ? row('Responsable', esc(i.shop.responsable)) : '') +
    (i.who.contract ? row('Contrat', esc(i.who.contract) + (i.who.cadre ? ' · cadre' : '')) : '') +
    (i.who.hireDate ? row('Date d\'entrée', esc(day(i.who.hireDate))) : '')
  )

  const req = table(
    row('Type', esc(i.type)) +
    (i.modification && i.oldRange
      ? row('Dates actuelles (validées)', `<span style="text-decoration:line-through;color:#8089A0;">${esc(rangeText(i.oldRange))}</span> — ${num(i.oldDays ?? 0)} j`)
        + row('Nouvelles dates demandées', esc(rangeText(i.range)))
      : row('Période', esc(rangeText(i.range)))) +
    (kind === 'info' ? '' : row('Jours décomptés', `<span style="font-size:15px;">${num(i.days)} j</span> <span style="font-weight:400;color:#8089A0;">(samedis compris, 5 jours au plus par semaine)</span>`)) +
    row('Demande déposée', esc(new Date(i.createdAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))) +
    (kind !== 'info' ? row('En attente depuis', esc(waitingText(i.waitingHours))) : '') +
    (i.reason ? row('Motif indiqué', esc(i.reason)) : '')
  )

  let balanceHtml = ''
  if (i.balance) {
    const b = i.balance
    const neg = b.after < 0
    balanceHtml = section(`Solde ${esc(b.label)}`, table(
      row('Jours acquis à poser', `${num(b.acquired)} j${b.split ? ` <span style="font-weight:400;color:#8089A0;">+ ${num(b.split)} j de fractionnement</span>` : ''}`) +
      (b.acquiring != null ? row('En cours d\'acquisition', `${num(b.acquiring)} j`) : '') +
      row('Déjà pris (validés)', `${num(b.taken)} j`) +
      (b.pendingOthers > 0 ? row('Autres demandes en attente', `${num(b.pendingOthers)} j`) : '') +
      row('Reste avant cette demande', `${num(b.before)} j`) +
      row('Reste après cette demande', `<span style="color:${neg ? '#DC2626' : '#1F9D57'};font-size:15px;">${num(b.after)} j</span>${neg ? ' <span style="font-weight:400;color:#DC2626;">— jours pris par anticipation</span>' : ''}`) +
      (b.cap ? row('Plafond 5 semaines (période du 1er juin)', `${num(b.cap.used)} / ${b.cap.limit} j${b.cap.used > b.cap.limit ? ' <span style="color:#DC2626;">— dépassé</span>' : ''}`) : '')
    ))
  }

  const alerts: string[] = []
  for (const w of i.blocks) alerts.push(`<strong style="color:#DC2626;">Période bloquée :</strong> ${esc(w)}`)
  for (const w of i.warnings) alerts.push(`Période déconseillée : ${esc(w)}`)
  for (const o of i.operations) alerts.push(`★ Opération commerciale : <strong>${esc(o.title)}</strong>${o.mecanique ? ` — ${esc(o.mecanique)}` : ''} (${esc(short(o.start!))}${o.end !== o.start ? ` → ${esc(short(o.end!))}` : ''})`)
  for (const o of i.overlapsShop) alerts.push(`Collègue absent : <strong>${esc(o.name)}</strong> — ${esc(o.type)}, ${esc(short(o.start))}${o.end !== o.start ? ` → ${esc(short(o.end))}` : ''}${o.status.includes('attente') ? ' (en attente)' : ''}`)
  const alertsHtml = alerts.length
    ? section(`Points d'attention (${alerts.length})`, bullet(alerts, '#B45309'), '#D97706')
    : section('Points d\'attention', `<p style="margin:0;font-size:13.5px;color:#1F9D57;font-weight:600;">Rien à signaler : aucune opération, aucun collègue absent, aucune période déconseillée.</p>`, '#1F9D57')

  const othersHtml = i.otherPending.length
    ? section('Autres demandes en attente de ce collaborateur', bullet(i.otherPending.map(o => `${esc(o.type)} — ${esc(short(o.start))}${o.end !== o.start ? ` → ${esc(short(o.end))}` : ''}`), '#1C1E26'))
    : ''

  const infoNote = kind === 'info'
    ? `<p style="margin:14px 0 0;font-size:13px;color:#5A6072;">Aucune validation n'est nécessaire (absence enregistrée directement, sans décompte de congés). Si un justificatif a été joint, il est consultable dans la gestion des congés boutiques.</p>`
    : ''

  return baseHtml({
    title: m.title,
    preheader: `${i.who.name} (${i.shop.name}) — ${rangeText(i.range)}${kind === 'info' ? '' : ` — ${num(i.days)} j`}`,
    deptColor: m.color,
    mandatory: true,
    content: `
      ${banner}
      <h2 style="margin:0 0 4px;font-size:21px;font-weight:700;color:#1C1E26;">${esc(urgent ? m.title : m.label)}</h2>
      <p style="margin:0 0 6px;color:#5A6072;font-size:14.5px;line-height:1.6;"><strong>${esc(i.who.name)}</strong> · ${esc(i.shop.name)} · ${esc(i.type)}${kind === 'info' ? '' : ` · <strong>${num(i.days)} j</strong>`}</p>
      ${section('Demandeur', who)}
      ${section('Demande', req)}
      ${balanceHtml}
      ${alertsHtml}
      ${othersHtml}
      ${infoNote}
      <div style="margin-top:22px;">${button({ label: kind === 'info' ? 'Voir dans la gestion RH →' : 'Valider ou refuser la demande →', color: m.color, href: link })}</div>
    `,
  })
}

/** Envoie à la RH validatrice l'e-mail détaillé d'une demande (jamais bloquant, jamais soumis aux préférences). */
export async function sendRhRequestMail(supabase: Admin, absenceId: string, kind: RhMailKind, opts: { edited?: boolean } = {}): Promise<number> {
  try {
    const [info, recipients] = await Promise.all([loadRequestInfo(supabase, absenceId), getRhRecipients(supabase)])
    if (!info || recipients.length === 0) return 0
    await sendEmail({ to: recipients, subject: (opts.edited ? 'Dates corrigées — ' : '') + requestSubject(info, kind), html: requestHtml(info, kind) })
    return recipients.length
  } catch (err) {
    console.error('[rhMail] envoi impossible', err)
    return 0
  }
}

/** Récapitulatif du lundi : toutes les demandes en attente, de la plus ancienne à la plus récente, avec le détail utile à la décision. */
export async function sendRhDigest(supabase: Admin): Promise<{ sent: number; pending: number }> {
  const recipients = await getRhRecipients(supabase)
  if (recipients.length === 0) return { sent: 0, pending: 0 }
  const { data: rows } = await supabase.from('absences')
    .select('id, created_at, user:profiles!user_id(boutique_id)').in('status', ['En attente', 'Modif. en attente'])
  const ids = (rows ?? []).filter((r: Record<string, unknown>) => !!one(r.user as Rel<{ boutique_id: string | null }>)?.boutique_id)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).map(r => r.id as string)
  if (ids.length === 0) return { sent: 0, pending: 0 }

  const infos = (await Promise.all(ids.slice(0, 30).map(id => loadRequestInfo(supabase, id).catch(() => null)))).filter((x): x is RequestInfo => !!x)
  infos.sort((a, b) => b.waitingHours - a.waitingHours)
  const over72 = infos.filter(i => i.waitingHours >= 72).length
  const over48 = infos.filter(i => i.waitingHours >= 48 && i.waitingHours < 72).length

  const card = (i: RequestInfo) => {
    const c = i.waitingHours >= 72 ? '#DC2626' : i.waitingHours >= 48 ? '#D97706' : RH_COLOR
    const badges: string[] = []
    if (i.modification) badges.push('<span style="background:#7E6FB01A;color:#7E6FB0;border-radius:12px;padding:2px 8px;font-size:11px;font-weight:700;">modification</span>')
    if (i.balance && i.balance.after < 0) badges.push('<span style="background:#DC26261A;color:#DC2626;border-radius:12px;padding:2px 8px;font-size:11px;font-weight:700;">solde négatif</span>')
    if (i.operations.length) badges.push(`<span style="background:#E0596A1A;color:#BE3F50;border-radius:12px;padding:2px 8px;font-size:11px;font-weight:700;">★ opération</span>`)
    if (i.overlapsShop.length) badges.push(`<span style="background:#F59E0B1F;color:#B45309;border-radius:12px;padding:2px 8px;font-size:11px;font-weight:700;">${i.overlapsShop.length} collègue${i.overlapsShop.length > 1 ? 's' : ''} absent${i.overlapsShop.length > 1 ? 's' : ''}</span>`)
    if (i.warnings.length) badges.push('<span style="background:#F59E0B1F;color:#B45309;border-radius:12px;padding:2px 8px;font-size:11px;font-weight:700;">période déconseillée</span>')
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #EAEDF2;border-radius:12px;margin:0 0 10px;">
        <tr><td style="width:4px;background:${c};border-radius:12px 0 0 12px;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:12px 16px;">
          <p style="margin:0;font-size:14.5px;font-weight:700;color:#1C1E26;">${esc(i.who.name)} <span style="font-weight:500;color:#6A7180;">· ${esc(i.shop.name)}</span></p>
          <p style="margin:3px 0 0;font-size:13px;color:#1C1E26;">${esc(i.type)} — ${esc(rangeText(i.range))} — <strong>${num(i.days)} j</strong>${i.balance ? ` · reste après : <strong style="color:${i.balance.after < 0 ? '#DC2626' : '#1F9D57'};">${num(i.balance.after)} j</strong>` : ''}</p>
          <p style="margin:3px 0 0;font-size:12.5px;color:${c};font-weight:600;">En attente depuis ${esc(waitingText(i.waitingHours))}</p>
          ${badges.length ? `<p style="margin:7px 0 0;">${badges.join(' ')}</p>` : ''}
          <p style="margin:7px 0 0;font-size:12.5px;"><a href="${APP_URL}/conges/rh?focus=${i.id}" style="color:${RH_COLOR};font-weight:600;text-decoration:none;">Ouvrir cette demande →</a></p>
        </td></tr></table>`
  }

  const html = baseHtml({
    title: 'Demandes de congés à traiter',
    preheader: `${ids.length} demande${ids.length > 1 ? 's' : ''} de boutiques en attente de validation`,
    deptColor: RH_COLOR,
    mandatory: true,
    content: `
      <h2 style="margin:0 0 6px;font-size:21px;font-weight:700;color:#1C1E26;">${ids.length} demande${ids.length > 1 ? 's' : ''} de congés à traiter</h2>
      <p style="margin:0 0 16px;color:#5A6072;font-size:14.5px;line-height:1.6;">
        Récapitulatif du lundi : demandes des boutiques encore en attente de validation, les plus anciennes en premier.
        ${over72 ? `<br/><strong style="color:#DC2626;">${over72} attend${over72 > 1 ? 'ent' : ''} depuis plus de 72 h.</strong>` : ''}
        ${over48 ? `<br/><strong style="color:#D97706;">${over48} attend${over48 > 1 ? 'ent' : ''} depuis plus de 48 h.</strong>` : ''}
      </p>
      ${infos.map(card).join('')}
      ${ids.length > infos.length ? `<p style="margin:0 0 16px;color:#6A7180;font-size:13px;">… et ${ids.length - infos.length} autre(s) dans la gestion RH.</p>` : ''}
      <div style="margin-top:18px;">${button({ label: 'Ouvrir la gestion des congés boutiques →', color: RH_COLOR, href: `${APP_URL}/conges/rh` })}</div>
    `,
  })
  await sendEmail({ to: recipients, subject: `🗓️ ${ids.length} demande${ids.length > 1 ? 's' : ''} de congés à traiter${over72 ? ` — dont ${over72} en attente depuis plus de 72 h` : over48 ? ` — dont ${over48} depuis plus de 48 h` : ''}`, html })
  return { sent: recipients.length, pending: ids.length }
}
