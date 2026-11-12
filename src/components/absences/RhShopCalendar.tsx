'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ABSENCE_COLORS, type AbsenceType } from '@/types/absences'
import { OP_CATEGORY_COLORS, OP_CATEGORY_LABELS, type OpCategory } from '@/types/pacMediaKit'

interface Shop { id: string; code: number; name: string }
interface PacItem {
  id: string; title: string; op_category: OpCategory
  op_date_debut: string | null; op_date_fin: string | null; op_mecanique?: string | null
}
interface Entry {
  id: string; type: AbsenceType; start_date: string; end_date: string; status: string
  user: { id: string; name: string; boutique_id: string }
}

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const STORAGE_KEY = 'relays-rh-calendar-shops'
const localDs = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Calendrier des congés des boutiques : on coche les magasins à afficher (mémorisé sur le poste).
 * Chaque absence indique le numéro du magasin et le nom complet du collaborateur.
 */
export function RhShopCalendar({ boutiques, absences }: { boutiques: Shop[]; absences: Entry[] }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [selected, setSelected] = useState<Set<string> | null>(null) // null = tout (tant que rien n'a été coché)
  const [dayDetail, setDayDetail] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setSelected(new Set(JSON.parse(raw) as string[]))
    } catch { /* stockage indisponible : on affiche tout */ }
  }, [])
  function save(next: Set<string> | null) {
    setSelected(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next ? [...next] : boutiques.map(b => b.id))) } catch { /* noop */ }
  }
  const isOn = (id: string) => selected === null || selected.has(id)
  function toggle(id: string) {
    const base = selected ?? new Set(boutiques.map(b => b.id))
    const next = new Set(base)
    if (next.has(id)) next.delete(id); else next.add(id)
    save(next)
  }

  // Opérations commerciales et Média Kit (planning Marketing/Web), pour choisir les congés en connaissance de cause.
  const [ops, setOps] = useState<PacItem[]>([])
  const [showOps, setShowOps] = useState(true)
  const [showMk, setShowMk] = useState(true)
  useEffect(() => {
    fetch('/api/pac-media-kit', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setOps(Array.isArray(d) ? d.filter((o: PacItem) => o.op_category === 'operation_commerciale' || o.op_category === 'media_kit') : []))
      .catch(() => setOps([]))
  }, [])
  const opsOn = (ds: string) => ops.filter(o => {
    if (o.op_category === 'operation_commerciale' ? !showOps : !showMk) return false
    const end = (o.op_date_fin ?? o.op_date_debut)?.slice(0, 10)
    const start = (o.op_date_debut ?? o.op_date_fin)?.slice(0, 10)
    return !!start && !!end && ds >= start && ds <= end
  })

  const shopById = useMemo(() => new Map(boutiques.map(b => [b.id, b])), [boutiques])
  const visible = useMemo(
    () => absences.filter(a => a.status !== 'Refusé' && isOn(a.user.boutique_id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [absences, selected]
  )

  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const startDay = (first.getDay() + 6) % 7
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < startDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.y, cursor.m, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [cursor])

  const on = (ds: string) => visible
    .filter(a => ds >= a.start_date && ds <= a.end_date)
    .sort((a, b) => (shopById.get(a.user.boutique_id)?.code ?? 0) - (shopById.get(b.user.boutique_id)?.code ?? 0) || a.user.name.localeCompare(b.user.name))
  const label = (a: Entry) => `${shopById.get(a.user.boutique_id)?.code ?? '?'} · ${a.user.name}`
  const todayStr = localDs(new Date())

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Magasins affichés</p>
          <div className="flex gap-1.5">
            <button onClick={() => save(null)} className="text-xs px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/70 font-medium">Tous</button>
            <button onClick={() => save(new Set())} className="text-xs px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/70 font-medium">Aucun</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {boutiques.map(b => (
            <button key={b.id} onClick={() => toggle(b.id)} title={b.name}
              className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${isOn(b.id) ? 'text-white border-transparent' : 'border-border text-muted-foreground hover:bg-muted'}`}
              style={isOn(b.id) ? { backgroundColor: 'var(--accent)' } : undefined}>
              {b.code} <span className="font-normal opacity-90">{b.name.replace(/^Aélys\s+/, '')}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-3 flex flex-wrap items-center gap-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Marketing &amp; Web</p>
        {([['operation_commerciale', showOps, setShowOps], ['media_kit', showMk, setShowMk]] as const).map(([cat, val, set]) => (
          <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} />
            <span className="w-3 h-3 rounded" style={{ backgroundColor: OP_CATEGORY_COLORS[cat] }} />
            {OP_CATEGORY_LABELS[cat]}
          </label>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor(c => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 })} className="p-2 rounded-lg hover:bg-muted"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="text-lg font-bold">{MONTHS[cursor.m]} {cursor.y}</h2>
          <button onClick={() => setCursor(c => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 })} className="p-2 rounded-lg hover:bg-muted"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map(d => <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((date, i) => {
            if (!date) return <div key={i} className="min-h-[96px]" />
            const ds = localDs(date)
            const items = on(ds)
            const weekend = date.getDay() === 0 || date.getDay() === 6
            return (
              <div key={i} className={`min-h-[96px] rounded-lg border p-1 overflow-hidden ${ds === todayStr ? 'border-2' : 'border-border'}`}
                style={{ ...(ds === todayStr ? { borderColor: 'var(--accent)' } : {}), ...(weekend ? { backgroundColor: 'var(--muted)', opacity: 0.6 } : {}) }}>
                <div className="text-xs font-semibold mb-0.5 text-muted-foreground">{date.getDate()}</div>
                {opsOn(ds).slice(0, 2).map(o => (
                  <div key={o.id} className="text-[0.55rem] leading-tight px-1 rounded truncate font-semibold mb-0.5"
                    style={{ backgroundColor: `${OP_CATEGORY_COLORS[o.op_category]}22`, color: OP_CATEGORY_COLORS[o.op_category] }}
                    title={`${OP_CATEGORY_LABELS[o.op_category]} : ${o.title}${o.op_mecanique ? ` — ${o.op_mecanique}` : ''}`}>
                    {o.op_category === 'media_kit' ? '▣' : '★'} {o.title}{o.op_mecanique && o.op_category === 'operation_commerciale' ? ` · ${o.op_mecanique}` : ''}
                  </div>
                ))}
                {opsOn(ds).length > 2 && <div className="text-[0.55rem] text-muted-foreground px-1">+{opsOn(ds).length - 2} autre(s)</div>}
                <div className="space-y-0.5">
                  {items.slice(0, 3).map(a => (
                    <div key={a.id} title={`${label(a)} · ${a.type}${a.status.includes('attente') ? ' (en attente)' : ''}`}
                      className="text-[0.58rem] leading-tight px-1 py-0.5 rounded truncate text-white font-medium"
                      style={{ backgroundColor: ABSENCE_COLORS[a.type], opacity: a.status.includes('attente') ? 0.5 : 1 }}>
                      {label(a)}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <button onClick={() => setDayDetail(ds)} className="w-full text-left text-[0.58rem] font-semibold text-muted-foreground px-1 rounded hover:bg-muted">
                      +{items.length - 3} — tout voir
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-border">
          {(['Congés payés', 'RTT', 'Alternance'] as AbsenceType[]).map(t => (
            <div key={t} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: ABSENCE_COLORS[t] }} />
              <span className="text-xs text-muted-foreground">{t}</span>
            </div>
          ))}
          <span className="text-xs text-muted-foreground">★ Opération commerciale · ▣ Média Kit</span>
          <span className="text-xs text-muted-foreground">· pastille pâle = en attente de validation</span>
        </div>
      </div>

      {dayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setDayDetail(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold tracking-tight mb-1">Absences ce jour</h2>
            <p className="text-sm text-muted-foreground mb-4 capitalize">
              {new Date(dayDetail + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div className="space-y-2">
              {on(dayDetail).map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-muted/40">
                  <span className="text-sm font-medium">{label(a)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-medium text-white" style={{ backgroundColor: ABSENCE_COLORS[a.type], opacity: a.status.includes('attente') ? 0.6 : 1 }}>
                    {a.type}{a.status.includes('attente') ? ' (en attente)' : ''}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={() => setDayDetail(null)} className="mt-4 w-full py-2 rounded-xl bg-muted text-sm font-medium hover:bg-muted/70">Fermer</button>
          </div>
        </div>
      )}
    </div>
  )
}
