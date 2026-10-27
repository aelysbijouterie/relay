'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, X, Download, Loader2, ClipboardList, Search, Store, Wallet, ListChecks } from 'lucide-react'
import { toast } from 'sonner'
import { ABSENCE_COLORS, ABSENCE_STATUS_COLORS, PERIOD_LABELS, type AbsencePeriod, type AbsenceStatus, type AbsenceType } from '@/types/absences'
import { countWorkdays } from '@/lib/absences/workdays'
import { OP_CATEGORY_COLORS } from '@/types/pacMediaKit'

interface Boutique { id: string; code: number; name: string; city: string | null; responsable: string | null }
interface Member { id: string; name: string; boutique_id: string; leave_balance_conges: number | null }
interface RhAbsence {
  id: string; user_id: string; type: AbsenceType
  start_date: string; end_date: string; start_period: AbsencePeriod; end_period: AbsencePeriod
  reason: string | null; status: AbsenceStatus; review_note: string | null; created_at: string
  pending_start_date: string | null; pending_end_date: string | null
  pending_start_period: AbsencePeriod | null; pending_end_period: AbsencePeriod | null
  user: { id: string; name: string; boutique_id: string }
}
interface Operation { id: string; title: string; op_date_debut: string | null; op_date_fin: string | null; op_category?: string }

type Tab = 'demandes' | 'soldes' | 'boutiques'
type StatusFilter = 'todo' | 'all' | 'Validé' | 'Refusé'

const isPending = (a: RhAbsence) => a.status === 'En attente' || a.status === 'Modif. en attente'
const fmtDay = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtShort = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const localDs = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function rangeOf(a: RhAbsence) {
  // Pour une demande de modification, c'est la NOUVELLE période qui est à valider.
  if (a.status === 'Modif. en attente' && a.pending_start_date && a.pending_end_date) {
    return { start: a.pending_start_date, end: a.pending_end_date, sp: a.pending_start_period ?? 'full', ep: a.pending_end_period ?? 'full' }
  }
  return { start: a.start_date, end: a.end_date, sp: a.start_period, ep: a.end_period }
}
function daysOf(a: RhAbsence): number { const r = rangeOf(a); return countWorkdays(r.start, r.end, r.sp, r.ep) }
function rangeLabel(a: RhAbsence): string {
  const r = rangeOf(a)
  const sp = r.sp !== 'full' ? ` (${PERIOD_LABELS[r.sp]})` : ''
  const ep = r.ep !== 'full' ? ` (${PERIOD_LABELS[r.ep]})` : ''
  return r.start === r.end ? `${fmtShort(r.start)}${sp}` : `${fmtShort(r.start)}${sp} → ${fmtShort(r.end)}${ep}`
}
const overlaps = (aS: string, aE: string, bS: string, bE: string) => aS <= bE && aE >= bS

export function RhConsole() {
  const [boutiques, setBoutiques] = useState<Boutique[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [absences, setAbsences] = useState<RhAbsence[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [tab, setTab] = useState<Tab>('demandes')

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todo')
  const [boutiqueFilter, setBoutiqueFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | AbsenceType>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [r, o] = await Promise.all([
        fetch('/api/rh/overview', { cache: 'no-store' }),
        fetch('/api/pac-media-kit', { cache: 'no-store' }),
      ])
      if (r.status === 403) { setDenied(true); return }
      const d = await r.json()
      setBoutiques(d.boutiques ?? []); setMembers(d.members ?? []); setAbsences(d.absences ?? [])
      const od = await o.json().catch(() => [])
      setOperations((Array.isArray(od) ? od : []).filter((x: Operation) => x.op_category === 'operation_commerciale'))
    } catch { toast.error('Chargement impossible') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const boutiqueById = useMemo(() => new Map(boutiques.map(b => [b.id, b])), [boutiques])

  const overlapCount = useCallback((a: RhAbsence) => {
    const r = rangeOf(a)
    return absences.filter(o => o.id !== a.id && o.status !== 'Refusé' && o.user.boutique_id === a.user.boutique_id
      && o.user_id !== a.user_id && overlaps(o.start_date, o.end_date, r.start, r.end)).length
  }, [absences])
  const opsHit = useCallback((a: RhAbsence) => {
    const r = rangeOf(a)
    return operations.filter(o => {
      const e = o.op_date_fin ?? o.op_date_debut; const s = o.op_date_debut ?? e
      return !!s && !!e && overlaps(s.slice(0, 10), e.slice(0, 10), r.start, r.end)
    })
  }, [operations])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return absences
      .filter(a => statusFilter === 'all' ? true : statusFilter === 'todo' ? isPending(a) : a.status === statusFilter)
      .filter(a => !boutiqueFilter || a.user.boutique_id === boutiqueFilter)
      .filter(a => typeFilter === 'all' || a.type === typeFilter)
      .filter(a => !q || a.user.name.toLowerCase().includes(q) || (boutiqueById.get(a.user.boutique_id)?.name ?? '').toLowerCase().includes(q))
      .sort((a, b) => (isPending(b) ? 1 : 0) - (isPending(a) ? 1 : 0) || rangeOf(a).start.localeCompare(rangeOf(b).start))
  }, [absences, statusFilter, boutiqueFilter, typeFilter, search, boutiqueById])

  const pendingCount = absences.filter(isPending).length

  async function reviewOne(id: string, status: 'Validé' | 'Refusé') {
    const r = await fetch(`/api/absences/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    if (!r.ok) throw new Error()
    fetch('/api/notify/absence-review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ absenceId: id, status }),
    }).catch(() => {})
  }
  async function review(ids: string[], status: 'Validé' | 'Refusé') {
    if (ids.length === 0) return
    setBusy(true)
    let ok = 0
    for (const id of ids) { try { await reviewOne(id, status); ok++ } catch { /* compté ci-dessous */ } }
    setBusy(false); setSelected(new Set())
    if (ok === ids.length) toast.success(`${ok} demande${ok > 1 ? 's' : ''} ${status === 'Validé' ? 'validée' : 'refusée'}${ok > 1 ? 's' : ''}`)
    else toast.error(`${ids.length - ok} demande(s) en échec sur ${ids.length}`)
    load()
  }

  function toggle(id: string) { setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  const selectablePending = filtered.filter(isPending)
  const selectedPending = selectablePending.filter(a => selected.has(a.id)).map(a => a.id)

  function exportCsv() {
    const head = ['Boutique', 'Code', 'Collaborateur', 'Type', 'Début', 'Fin', 'Jours ouvrés', 'Statut', 'Motif', 'Demandé le']
    const rows = filtered.map(a => {
      const r = rangeOf(a); const b = boutiqueById.get(a.user.boutique_id)
      return [b?.name ?? '', b?.code ?? '', a.user.name, a.type, r.start, r.end, String(daysOf(a)).replace('.', ','), a.status, a.reason ?? '', a.created_at.slice(0, 10)]
    })
    const csv = [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const el = document.createElement('a')
    el.href = url; el.download = `conges-boutiques-${localDs(new Date())}.csv`; el.click()
    URL.revokeObjectURL(url)
  }

  // ── Soldes : CP validés de l'année en cours, par collaborateur
  const year = new Date().getFullYear()
  const takenByMember = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of absences) {
      if (a.type !== 'Congés payés' || a.status !== 'Validé' || !a.start_date.startsWith(String(year))) continue
      m.set(a.user_id, (m.get(a.user_id) ?? 0) + countWorkdays(a.start_date, a.end_date, a.start_period, a.end_period))
    }
    return m
  }, [absences, year])

  async function saveBalance(userId: string, value: string) {
    const current = members.find(m => m.id === userId)?.leave_balance_conges
    if ((value === '' ? null : Number(value)) === current) return
    const r = await fetch('/api/rh/overview', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, conges: value }),
    })
    if (!r.ok) { toast.error('Enregistrement impossible'); return }
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, leave_balance_conges: value === '' ? null : Number(value) } : m))
    toast.success('Solde enregistré')
  }

  // ── Vue par boutique
  const today = localDs(new Date())
  const in30 = localDs(new Date(Date.now() + 30 * 86400000))
  const in60 = localDs(new Date(Date.now() + 60 * 86400000))
  const boutiqueCards = useMemo(() => boutiques.map(b => {
    const mine = absences.filter(a => a.user.boutique_id === b.id && a.status !== 'Refusé')
    const absentToday = mine.filter(a => a.start_date <= today && a.end_date >= today).map(a => a.user.name)
    const upcoming = mine.filter(a => a.end_date >= today && a.start_date <= in30).sort((x, y) => x.start_date.localeCompare(y.start_date))
    // Jours des 60 prochains jours où au moins 2 personnes de la boutique sont absentes.
    const tension: string[] = []
    for (let i = 0; i <= 60; i++) {
      const d = localDs(new Date(Date.now() + i * 86400000))
      const dow = new Date(d + 'T00:00:00').getDay()
      if (dow === 0 || dow === 6) continue
      if (new Set(mine.filter(a => a.start_date <= d && a.end_date >= d).map(a => a.user_id)).size >= 2) tension.push(d)
    }
    const opClash = new Set<string>()
    for (const a of mine) {
      if (a.end_date < today || a.start_date > in60) continue
      for (const o of operations) {
        const e = o.op_date_fin ?? o.op_date_debut; const s = o.op_date_debut ?? e
        if (s && e && overlaps(s.slice(0, 10), e.slice(0, 10), a.start_date, a.end_date)) opClash.add(o.title)
      }
    }
    return {
      b, absentToday, upcoming, tension, opClash: [...opClash],
      pending: absences.filter(a => a.user.boutique_id === b.id && isPending(a)).length,
      memberCount: members.filter(m => m.boutique_id === b.id).length,
    }
  }), [boutiques, absences, members, operations, today, in30, in60])

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  if (denied) return <p className="text-sm text-muted-foreground text-center py-24">Cette page est réservée à la RH.</p>

  const tabs: { id: Tab; label: string; icon: typeof ListChecks }[] = [
    { id: 'demandes', label: 'Demandes', icon: ListChecks },
    { id: 'soldes', label: 'Soldes de CP', icon: Wallet },
    { id: 'boutiques', label: 'Vue par boutique', icon: Store },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Gestion RH — boutiques</h1>
            <p className="text-sm text-muted-foreground">
              {pendingCount > 0 ? `${pendingCount} demande${pendingCount > 1 ? 's' : ''} à traiter` : 'Aucune demande en attente'}
            </p>
          </div>
        </div>
        <button onClick={exportCsv} disabled={tab !== 'demandes' || filtered.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors disabled:opacity-40">
          <Download className="w-4 h-4" /> Exporter en CSV
        </button>
      </div>

      <div className="inline-flex rounded-xl border border-border overflow-hidden">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${tab === t.id ? 'text-white' : 'hover:bg-muted'}`}
            style={tab === t.id ? { backgroundColor: 'var(--accent)' } : undefined}>
            <t.icon className="w-4 h-4" /> {t.label}
            {t.id === 'demandes' && pendingCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[0.65rem] font-bold inline-flex items-center justify-center">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'demandes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Collaborateur ou boutique…"
                className="pl-8 pr-3 py-2 rounded-lg bg-muted/50 border border-border text-sm w-56 focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm">
              <option value="todo">À traiter</option><option value="all">Tous les statuts</option>
              <option value="Validé">Validées</option><option value="Refusé">Refusées</option>
            </select>
            <select value={boutiqueFilter} onChange={e => setBoutiqueFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm max-w-[14rem]">
              <option value="">Toutes les boutiques</option>
              {boutiques.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as 'all' | AbsenceType)}
              className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm">
              <option value="all">Tous les types</option><option value="Congés payés">Congés payés</option><option value="Alternance">Alternance</option>
            </select>
            {selectedPending.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{selectedPending.length} sélectionnée{selectedPending.length > 1 ? 's' : ''}</span>
                <button onClick={() => review(selectedPending, 'Validé')} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 text-green-700 hover:bg-green-500/20 text-sm font-semibold disabled:opacity-50">
                  <Check className="w-4 h-4" /> Valider
                </button>
                <button onClick={() => review(selectedPending, 'Refusé')} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 text-sm font-semibold disabled:opacity-50">
                  <X className="w-4 h-4" /> Refuser
                </button>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="p-3 w-8">
                    <input type="checkbox" aria-label="Tout sélectionner"
                      checked={selectablePending.length > 0 && selectedPending.length === selectablePending.length}
                      onChange={e => setSelected(e.target.checked ? new Set(selectablePending.map(a => a.id)) : new Set())} />
                  </th>
                  <th className="p-3">Boutique</th><th className="p-3">Collaborateur</th><th className="p-3">Type</th>
                  <th className="p-3">Période</th><th className="p-3 text-right">Jours</th><th className="p-3">Alertes</th>
                  <th className="p-3">Statut</th><th className="p-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Aucune demande pour ces filtres.</td></tr>
                )}
                {filtered.map(a => {
                  const oc = overlapCount(a); const hits = opsHit(a)
                  return (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="p-3">{isPending(a) && <input type="checkbox" aria-label="Sélectionner" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />}</td>
                      <td className="p-3 whitespace-nowrap">{boutiqueById.get(a.user.boutique_id)?.name ?? '—'}</td>
                      <td className="p-3 font-medium whitespace-nowrap">{a.user.name}</td>
                      <td className="p-3 whitespace-nowrap"><span style={{ color: ABSENCE_COLORS[a.type] }} className="font-semibold">{a.type}</span></td>
                      <td className="p-3 whitespace-nowrap">
                        {rangeLabel(a)}
                        {a.status === 'Modif. en attente' && <span className="ml-1.5 text-[0.65rem] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">modif</span>}
                        {a.reason && <p className="text-xs text-muted-foreground max-w-[16rem] truncate" title={a.reason}>{a.reason}</p>}
                      </td>
                      <td className="p-3 text-right tabular-nums">{String(daysOf(a)).replace('.', ',')}</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          {oc > 0 && <span className="text-[0.7rem] px-1.5 py-0.5 rounded font-semibold w-fit" style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#B45309' }}>⚠ {oc} autre{oc > 1 ? 's' : ''} absent{oc > 1 ? 's' : ''}</span>}
                          {hits.length > 0 && <span className="text-[0.7rem] px-1.5 py-0.5 rounded font-semibold w-fit" style={{ backgroundColor: `${OP_CATEGORY_COLORS.operation_commerciale}1f`, color: '#BE3F50' }} title={hits.map(h => h.title).join(', ')}>★ Opération : {hits[0].title}{hits.length > 1 ? ` +${hits.length - 1}` : ''}</span>}
                        </div>
                      </td>
                      <td className="p-3"><span className="text-xs px-2 py-1 rounded-md font-semibold text-white whitespace-nowrap" style={{ backgroundColor: ABSENCE_STATUS_COLORS[a.status] }}>{a.status}</span></td>
                      <td className="p-3">
                        {isPending(a) && (
                          <div className="flex gap-1.5 justify-end">
                            <button onClick={() => review([a.id], 'Validé')} disabled={busy} title="Valider"
                              className="p-2 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 disabled:opacity-50"><Check className="w-4 h-4" /></button>
                            <button onClick={() => review([a.id], 'Refusé')} disabled={busy} title="Refuser"
                              className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-50"><X className="w-4 h-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'soldes' && (
        <div className="space-y-4">
          <select value={boutiqueFilter} onChange={e => setBoutiqueFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm max-w-[16rem]">
            <option value="">Toutes les boutiques</option>
            {boutiques.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
          </select>
          <div className="bg-card border border-border rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="p-3">Boutique</th><th className="p-3">Collaborateur</th>
                  <th className="p-3 text-right">Solde {year} (jours)</th><th className="p-3 text-right">Pris</th><th className="p-3 text-right">Restant</th>
                </tr>
              </thead>
              <tbody>
                {members.filter(m => !boutiqueFilter || m.boutique_id === boutiqueFilter).length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Aucun collaborateur pour l&apos;instant. Ils apparaissent dès que les boutiques les ajoutent.</td></tr>
                )}
                {members.filter(m => !boutiqueFilter || m.boutique_id === boutiqueFilter)
                  .sort((a, b) => (boutiqueById.get(a.boutique_id)?.code ?? 0) - (boutiqueById.get(b.boutique_id)?.code ?? 0) || a.name.localeCompare(b.name))
                  .map(m => {
                    const taken = takenByMember.get(m.id) ?? 0
                    const remaining = m.leave_balance_conges != null ? m.leave_balance_conges - taken : null
                    return (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="p-3 whitespace-nowrap">{boutiqueById.get(m.boutique_id)?.name ?? '—'}</td>
                        <td className="p-3 font-medium">{m.name}</td>
                        <td className="p-3 text-right">
                          <input type="number" step="0.5" min="0" defaultValue={m.leave_balance_conges ?? ''}
                            key={`${m.id}-${m.leave_balance_conges ?? ''}`}
                            onBlur={e => saveBalance(m.id, e.target.value)}
                            className="w-24 px-2 py-1 rounded-lg bg-background border border-border text-sm text-right focus:outline-none focus:ring-1 focus:ring-muted-foreground" />
                        </td>
                        <td className="p-3 text-right tabular-nums">{String(taken).replace('.', ',')}</td>
                        <td className={`p-3 text-right tabular-nums font-semibold ${remaining != null && remaining < 0 ? 'text-red-600' : ''}`}>
                          {remaining == null ? '—' : String(remaining).replace('.', ',')}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">« Pris » = congés payés validés commençant en {year}, comptés en jours ouvrés (fériés exclus).</p>
        </div>
      )}

      {tab === 'boutiques' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {boutiqueCards.map(({ b, absentToday, upcoming, tension, opClash, pending, memberCount }) => (
            <div key={b.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold leading-tight">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.code} · {memberCount} collaborateur{memberCount > 1 ? 's' : ''} déclaré{memberCount > 1 ? 's' : ''}</p>
                </div>
                {pending > 0 && (
                  <button onClick={() => { setBoutiqueFilter(b.id); setStatusFilter('todo'); setTab('demandes') }}
                    className="text-[0.7rem] px-2 py-1 rounded-md font-semibold text-white" style={{ backgroundColor: '#F59E0B' }}>
                    {pending} à traiter
                  </button>
                )}
              </div>
              <div className="text-sm">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Aujourd&apos;hui</p>
                <p>{absentToday.length > 0 ? absentToday.join(', ') : <span className="text-muted-foreground">Personne d&apos;absent</span>}</p>
              </div>
              <div className="text-sm">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">30 prochains jours</p>
                {upcoming.length === 0 ? <p className="text-muted-foreground">Rien de prévu</p> : (
                  <ul className="space-y-0.5">
                    {upcoming.slice(0, 5).map(a => (
                      <li key={a.id} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ABSENCE_COLORS[a.type], opacity: isPending(a) ? 0.5 : 1 }} />
                        <span className="truncate">{a.user.name} · {fmtShort(a.start_date)}{a.end_date !== a.start_date ? ` → ${fmtShort(a.end_date)}` : ''}{isPending(a) ? ' (en attente)' : ''}</span>
                      </li>
                    ))}
                    {upcoming.length > 5 && <li className="text-xs text-muted-foreground">+{upcoming.length - 5} autre(s)</li>}
                  </ul>
                )}
              </div>
              {(tension.length > 0 || opClash.length > 0) && (
                <div className="space-y-1 pt-1 border-t border-border">
                  {tension.length > 0 && (
                    <p className="text-xs font-semibold" style={{ color: '#B45309' }}>
                      ⚠ 2 absents ou plus : {tension.length} jour{tension.length > 1 ? 's' : ''} (dès le {fmtShort(tension[0])})
                    </p>
                  )}
                  {opClash.length > 0 && (
                    <p className="text-xs font-semibold" style={{ color: '#BE3F50' }}>★ Congés pendant : {opClash.slice(0, 2).join(', ')}{opClash.length > 2 ? '…' : ''}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
