import type { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { baseHtml, button } from '@/emails/baseHtml'
import { countWorkdays, boutiqueDayOptions } from '@/lib/absences/workdays'
import { leavePeriod, LEAVE_PERIOD_CAP_DAYS } from '@/lib/absences/leaveRules'
import { evaluateForBoutique } from '@/lib/absences/leaveRulesServer'
import type { AbsencePeriod } from '@/types/absences'

type Admin = ReturnType<typeof createAdminClient>

export type RhMailKind = 'new' | 'modification' | 'info' | 'reminder72'

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
  attachmentName: string | null
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

  // Justificatif joint (colonnes de la migration 029 : lecture tolérante)
  let attachmentName: string | null = null
  try {
    const { data: att, error } = await supabase.from('absences').select('attachment_name').eq('id', absenceId).single()
    if (!error) attachmentName = (att?.attachment_name as string | null) ?? null
  } catch { /* migration 029 pas encore passée */ }

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
    range, oldRange, days, oldDays, balance, warnings, blocks, overlapsShop, operations, otherPending, attachmentName,
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
  new:          { emoji: '🗓️', label: 'Congés à valider',                 color: RH_COLOR,  title: 'Nouvelle demande de congés à valider' },
  modification: { emoji: '✏️', label: 'Modification à valider',           color: '#7E6FB0', title: 'Demande de modification à valider' },
  info:         { emoji: '🩺', label: 'Absence signalée',                 color: '#64748B', title: 'Absence signalée par une boutique' },
  reminder72:   { emoji: '🚨', label: 'Rappel 72 h — urgent',             color: '#DC2626', title: 'Rappel urgent : demande en attente depuis 72 h' },
}

// ── Éléments de mise en page (tables + styles inline : compatibles avec tous les clients mail) ──
const kv = (k: string, v: string) =>
  `<tr><td style="padding:7px 14px 7px 0;color:#6A7180;font-size:13px;white-space:nowrap;vertical-align:top;border-bottom:1px solid #F0F2F6;">${k}</td><td style="padding:7px 0;color:#1C1E26;font-size:13.5px;font-weight:600;border-bottom:1px solid #F0F2F6;">${v}</td></tr>`
const kvTable = (rows: string) => `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${rows}</table>`
const block = (n: number, title: string, inner: string, color: string) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;"><tr>
    <td style="width:26px;vertical-align:top;"><div style="width:22px;height:22px;border-radius:11px;background:${color};color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:22px;">${n}</div></td>
    <td style="vertical-align:top;"><p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1C1E26;">${title}</p>${inner}</td>
  </tr></table>`
const tile = (label: string, value: string, sub: string, color = '#1C1E26') =>
  `<td style="width:33.33%;padding:0 4px;vertical-align:top;"><div style="background:#F6F8FB;border:1px solid #E6EAF1;border-radius:12px;padding:12px 10px;text-align:center;">
    <div style="font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8089A0;">${label}</div>
    <div style="margin:5px 0 2px;font-size:19px;font-weight:800;color:${color};line-height:1.15;">${value}</div>
    <div style="font-size:11.5px;color:#6A7180;">${sub}</div></div></td>`
const flag = (icon: string, text: string, color: string) =>
  `<tr><td style="width:24px;vertical-align:top;padding:3px 0;font-size:14px;">${icon}</td><td style="padding:3px 0;font-size:13.5px;line-height:1.5;color:${color};">${text}</td></tr>`

export function requestSubject(i: RequestInfo, kind: RhMailKind): string {
  const m = KIND_META[kind]
  const where = `${i.who.name} (${i.shop.name})`
  const dates = i.range.start === i.range.end ? short(i.range.start) : `${short(i.range.start)} → ${short(i.range.end)}`
  const emoji = kind === 'info' && i.type === 'Alternance' ? '🎓' : m.emoji
  const head = kind === 'info' ? (i.type === 'Alternance' ? 'Alternance enregistrée' : 'Absence signalée') : m.label
  return `${emoji} ${head} — ${where} · ${dates}${kind === 'info' ? '' : ` · ${num(i.days)} j`}`
}

export function requestHtml(i: RequestInfo, kind: RhMailKind): string {
  const m = KIND_META[kind]
  const urgent = kind === 'reminder72'
  const info = kind === 'info'
  const link = `${APP_URL}/conges/rh?focus=${i.id}`
  const b = i.balance
  const kindChip = info ? (i.type === 'Alternance' ? 'Alternance enregistrée' : 'Absence signalée') : m.label

  const banner = urgent
    ? `<div style="background:${m.color}12;border:1px solid ${m.color}55;border-radius:12px;padding:13px 16px;margin:0 0 18px;"><p style="margin:0;font-size:14px;font-weight:700;color:${m.color};">🚨 En attente depuis ${esc(waitingText(i.waitingHours))}</p><p style="margin:4px 0 0;font-size:13px;color:#5A6072;">Le magasin n'a toujours pas de réponse et ne peut pas s'organiser.</p></div>`
    : ''

  // 1 · Résumé : les trois chiffres utiles pour décider, en un coup d'œil
  const dateTile = i.range.start === i.range.end ? short(i.range.start) : `${short(i.range.start)} → ${short(i.range.end)}`
  const tiles = info
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;"><tr>
        ${tile('Type', esc(i.type), 'sans validation')}
        ${tile('Du', esc(short(i.range.start)), esc(periodLabel(i.range.sp).trim() || 'journée entière'))}
        ${tile('Au', esc(short(i.range.end)), esc(periodLabel(i.range.ep).trim() || 'journée entière'))}
      </tr></table>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;"><tr>
        ${tile('Dates', esc(dateTile), esc(i.type))}
        ${tile('Jours décomptés', `${num(i.days)} j`, 'samedis compris')}
        ${b ? tile('Reste après', `${num(b.after)} j`, b.after < 0 ? 'par anticipation' : `sur ${num(b.before)} j`, b.after < 0 ? '#DC2626' : '#1F9D57') : tile('Déposée', esc(short(i.createdAt.slice(0, 10))), 'à valider')}
      </tr></table>`

  const cta = `<div style="margin:20px 0 4px;text-align:center;">${button({ label: info ? 'Voir dans la gestion RH →' : 'Valider ou refuser la demande →', color: m.color, href: link })}</div>`

  // 2 · Points d'attention, classés par gravité
  const reds: string[] = [], oranges: string[] = []
  for (const w of i.blocks) reds.push(`<strong>Période bloquée :</strong> ${esc(w)}`)
  if (b && b.after < 0) oranges.push(`<strong>Solde négatif :</strong> ${num(Math.abs(b.after))} j pris par anticipation`)
  if (b?.cap && b.cap.used > b.cap.limit) reds.push(`<strong>Plafond dépassé :</strong> ${num(b.cap.used)} j sur ${b.cap.limit} j sur la période`)
  for (const w of i.warnings) oranges.push(`<strong>Période déconseillée :</strong> ${esc(w)}`)
  for (const o of i.operations) oranges.push(`<strong>★ Opération commerciale :</strong> ${esc(o.title)}${o.mecanique ? ` (${esc(o.mecanique)})` : ''}, du ${esc(short(o.start!))} au ${esc(short(o.end!))}`)
  for (const o of i.overlapsShop) oranges.push(`<strong>Collègue absent :</strong> ${esc(o.name)} — ${esc(o.type)}, du ${esc(short(o.start))} au ${esc(short(o.end))}${o.status.includes('attente') ? ' (en attente)' : ''}`)
  const attention = info ? '' : block(1, 'À vérifier avant de décider',
    reds.length + oranges.length === 0
      ? `<table cellpadding="0" cellspacing="0" style="width:100%;">${flag('✅', 'Rien à signaler : aucune opération commerciale, aucun collègue absent, aucune période déconseillée, solde suffisant.', '#1F9D57')}</table>`
      : `<table cellpadding="0" cellspacing="0" style="width:100%;">${reds.map(t => flag('🔴', t, '#B91C1C')).join('')}${oranges.map(t => flag('🟠', t, '#92400E')).join('')}</table>`,
    reds.length ? '#DC2626' : oranges.length ? '#D97706' : '#1F9D57')

  // 3 · La demande
  const num2 = info ? 1 : 2
  const request = block(num2, 'La demande', kvTable(
    kv('Type', esc(i.type)) +
    (i.modification && i.oldRange
      ? kv('Dates actuelles', `<span style="text-decoration:line-through;color:#8089A0;font-weight:500;">${esc(rangeText(i.oldRange))}</span> <span style="font-weight:500;color:#8089A0;">(${num(i.oldDays ?? 0)} j)</span>`)
        + kv('Nouvelles dates', esc(rangeText(i.range)))
      : kv('Période', esc(rangeText(i.range)))) +
    (info ? '' : kv('Jours décomptés', `${num(i.days)} j <span style="font-weight:400;color:#8089A0;">(5 jours au plus par semaine, dimanches et fériés exclus)</span>`)) +
    (i.reason ? kv('Motif indiqué', esc(i.reason)) : '') +
    kv('Déposée le', esc(new Date(i.createdAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))) +
    (info ? '' : kv('En attente depuis', esc(waitingText(i.waitingHours)))) +
    (i.attachmentName ? kv('Justificatif joint', `📎 ${esc(i.attachmentName)} — <a href="${link}" style="color:${m.color};text-decoration:none;">ouvrir</a>`) : (info && (i.type === 'Maladie') ? kv('Justificatif', '<span style="font-weight:500;color:#8089A0;">non joint</span>') : ''))
  ), m.color)

  // 4 · Solde
  let balanceBlock = ''
  if (b) {
    balanceBlock = block(num2 + 1, `Solde ${esc(b.label)}`, kvTable(
      kv('Jours acquis à poser', `${num(b.acquired)} j${b.split ? ` <span style="font-weight:400;color:#8089A0;">+ ${num(b.split)} j de fractionnement</span>` : ''}`) +
      (b.acquiring != null ? kv('En cours d\'acquisition', `${num(b.acquiring)} j`) : '') +
      kv('Déjà pris (validés)', `− ${num(b.taken)} j`) +
      (b.pendingOthers > 0 ? kv('Autres demandes en attente', `− ${num(b.pendingOthers)} j`) : '') +
      kv('Reste avant cette demande', `${num(b.before)} j`) +
      kv('Cette demande', `− ${num(i.days)} j`) +
      kv('Reste après', `<span style="color:${b.after < 0 ? '#DC2626' : '#1F9D57'};font-size:15px;">${num(b.after)} j</span>`) +
      (b.cap ? kv('Plafond 5 semaines', `${num(b.cap.used)} / ${b.cap.limit} j <span style="font-weight:400;color:#8089A0;">(période du 1er juin)</span>`) : '')
    ), '#3E8FCC')
  }

  // 5 · Collaborateur et magasin
  const who = block(num2 + (b ? 2 : 1), 'Collaborateur et magasin', kvTable(
    kv('Collaborateur', esc(i.who.name)) +
    kv('Magasin', `${i.shop.code != null ? `n° ${esc(i.shop.code)} · ` : ''}${esc(i.shop.name)}${i.shop.city ? ` (${esc(i.shop.city)})` : ''}`) +
    (i.shop.responsable ? kv('Responsable', esc(i.shop.responsable)) : '') +
    (i.who.contract ? kv('Contrat', esc(i.who.contract) + (i.who.cadre ? ' · cadre' : '')) : '') +
    (i.who.hireDate ? kv('Date d\'entrée', esc(day(i.who.hireDate))) : '')
  ), '#7E6FB0')

  const others = i.otherPending.length
    ? block(num2 + (b ? 3 : 2), 'Autres demandes en attente de ce collaborateur',
        `<ul style="margin:0;padding-left:18px;color:#1C1E26;font-size:13.5px;line-height:1.55;">${i.otherPending.map(o => `<li>${esc(o.type)} — du ${esc(short(o.start))} au ${esc(short(o.end))}</li>`).join('')}</ul>`, '#64748B')
    : ''

  const infoNote = info
    ? `<p style="margin:18px 0 0;padding:11px 14px;background:#F6F8FB;border-radius:10px;font-size:13px;color:#5A6072;line-height:1.5;">Aucune validation n'est nécessaire : l'absence est enregistrée directement, sans décompte de congés.</p>`
    : ''

  return baseHtml({
    title: m.title,
    preheader: `${i.who.name} (${i.shop.name}) — ${rangeText(i.range)}${info ? '' : ` — ${num(i.days)} j`}`,
    deptColor: m.color,
    mandatory: true,
    content: `
      ${banner}
      <p style="margin:0 0 6px;"><span style="display:inline-block;background:${m.color}16;color:${m.color};border-radius:20px;padding:3px 11px;font-size:11.5px;font-weight:700;letter-spacing:.03em;">${esc(kindChip)}</span></p>
      <h2 style="margin:0;font-size:22px;font-weight:800;color:#1C1E26;letter-spacing:-0.01em;">${esc(i.who.name)}</h2>
      <p style="margin:2px 0 0;color:#5A6072;font-size:14.5px;">${i.shop.code != null ? `n° ${esc(i.shop.code)} · ` : ''}${esc(i.shop.name)}${i.shop.city ? ` · ${esc(i.shop.city)}` : ''}</p>
      ${tiles}
      ${cta}
      ${attention}
      ${request}
      ${balanceBlock}
      ${who}
      ${others}
      ${infoNote}
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

  const card = (i: RequestInfo) => {
    const c = i.waitingHours >= 72 ? '#DC2626' : RH_COLOR
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
      </p>
      ${infos.map(card).join('')}
      ${ids.length > infos.length ? `<p style="margin:0 0 16px;color:#6A7180;font-size:13px;">… et ${ids.length - infos.length} autre(s) dans la gestion RH.</p>` : ''}
      <div style="margin-top:18px;">${button({ label: 'Ouvrir la gestion des congés boutiques →', color: RH_COLOR, href: `${APP_URL}/conges/rh` })}</div>
    `,
  })
  await sendEmail({ to: recipients, subject: `🗓️ ${ids.length} demande${ids.length > 1 ? 's' : ''} de congés à traiter${over72 ? ` — dont ${over72} en attente depuis plus de 72 h` : ''}`, html })
  return { sent: recipients.length, pending: ids.length }
}
