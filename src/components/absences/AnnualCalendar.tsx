'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Printer, ArrowLeft, Loader2 } from 'lucide-react'
import { holidayName } from '@/lib/calendar/holidays'
import { countWorkdays, boutiqueDayOptions } from '@/lib/absences/workdays'
import { ABSENCE_COLORS, type Absence } from '@/types/absences'

interface BlockedPeriod { label: string; start: string; end: string }
type LayoutId = 'lignes' | 'colonnes' | 'grilles'

const LAYOUTS: { id: LayoutId; label: string; hint: string }[] = [
  { id: 'colonnes', label: 'Mois en colonnes', hint: 'De haut en bas : 6 mois par page, les jours 1 à 31 en lignes (2 pages)' },
  { id: 'grilles',  label: 'Calendriers mensuels', hint: '6 calendriers de mois par page, comme un calendrier papier (2 pages)' },
  { id: 'lignes',   label: 'Mois en lignes', hint: 'Les 12 mois en lignes sur une page, puis un récapitulatif par collaborateur (2 pages)' },
]

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const WEEKDAY_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const pad = (n: number) => String(n).padStart(2, '0')
const ds = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

// Initiales uniques par collaborateur (Léa BERNARD → LB ; en cas de doublon : LEB, puis un chiffre).
function buildCodes(names: string[]): Map<string, string> {
  const out = new Map<string, string>(), used = new Set<string>()
  for (const name of Array.from(new Set(names)).sort()) {
    const parts = name.trim().split(/\s+/)
    const first = parts[0] ?? '', last = parts[parts.length - 1] ?? ''
    const candidates = [`${first[0] ?? ''}${last[0] ?? ''}`, `${first.slice(0, 2)}${last[0] ?? ''}`, `${first[0] ?? ''}${last.slice(0, 2)}`].map(c => c.toUpperCase())
    let code = candidates.find(c => c && !used.has(c))
    for (let i = 2; !code; i++) { const c = `${candidates[0]}${i}`; if (!used.has(c)) code = c }
    used.add(code); out.set(name, code)
  }
  return out
}

/**
 * Planning annuel d'une boutique, imprimable en A4 paysage sur 2 pages, avec trois mises en page au choix :
 * mois en colonnes (haut en bas), calendriers mensuels, mois en lignes + récapitulatif.
 */
export function AnnualCalendar() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [layout, setLayout] = useState<LayoutId>('colonnes')
  const [absences, setAbsences] = useState<Absence[]>([])
  const [blocked, setBlocked] = useState<BlockedPeriod[]>([])
  const [shop, setShop] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { // mise en page mémorisée sur ce poste
    try { const v = localStorage.getItem('relays-annual-layout'); if (v === 'lignes' || v === 'colonnes' || v === 'grilles') setLayout(v) } catch { /* noop */ }
  }, [])
  function pick(id: LayoutId) { setLayout(id); try { localStorage.setItem('relays-annual-layout', id) } catch { /* noop */ } }

  useEffect(() => {
    Promise.all([
      fetch('/api/absences', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
      fetch('/api/absences/blocked-periods', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
      fetch('/api/boutique/members', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
    ]).then(([a, b, s]) => {
      setAbsences(Array.isArray(a) ? a : [])
      setBlocked(Array.isArray(b) ? b : [])
      setShop(s?.boutique?.name ?? '')
    }).finally(() => setLoading(false))
  }, [])

  // Absences de l'année (les refusées sont écartées)
  const yearAbs = useMemo(() =>
    absences.filter(a => a.status !== 'Refusé' && a.start_date <= `${year}-12-31` && a.end_date >= `${year}-01-01`),
    [absences, year])
  const codes = useMemo(() => buildCodes(yearAbs.map(a => a.user?.name ?? '?')), [yearAbs])

  const byDay = useMemo(() => {
    const map = new Map<string, Absence[]>()
    for (const a of yearAbs) {
      const from = a.start_date < `${year}-01-01` ? `${year}-01-01` : a.start_date
      const to = a.end_date > `${year}-12-31` ? `${year}-12-31` : a.end_date
      for (let d = new Date(from + 'T00:00:00'); ds(d.getFullYear(), d.getMonth(), d.getDate()) <= to; d.setDate(d.getDate() + 1)) {
        const k = ds(d.getFullYear(), d.getMonth(), d.getDate())
        map.set(k, [...(map.get(k) ?? []), a])
      }
    }
    return map
  }, [yearAbs, year])

  const blockedLabel = (date: string) => blocked.find(p => date >= p.start && date <= p.end)?.label ?? null
  const yearBlocked = blocked.filter(p => p.start <= `${year}-12-31` && p.end >= `${year}-01-01`).sort((a, b) => a.start.localeCompare(b.start))

  // Fond d'un jour : bloqué (rouge) > férié (violet) > dimanche (gris) > blanc
  function dayInfo(m: number, d: number) {
    const date = ds(year, m, d), wd = new Date(year, m, d).getDay()
    const ferie = holidayName(date), bl = blockedLabel(date), list = byDay.get(date) ?? []
    return {
      date, wd, ferie, bl, list,
      bg: bl ? '#FECACA' : ferie ? '#F5D0FE' : wd === 0 ? '#E5E7EB' : '#FFFFFF',
      title: [ferie, bl ? `Demande impossible : ${bl}` : null, ...list.map(a => `${a.user?.name} · ${a.type}`)].filter(Boolean).join('\n'),
    }
  }
  const Badge = ({ a, size }: { a: Absence; size: number }) => (
    <span className="inline-block text-center font-bold text-white rounded-[1px] px-[1.5px] leading-[1.25]"
      style={{ fontSize: `${size}px`, backgroundColor: ABSENCE_COLORS[a.type], opacity: a.status.includes('attente') ? 0.55 : 1 }}>
      {codes.get(a.user?.name ?? '?')}
    </span>
  )

  // Récapitulatif par collaborateur
  const recap = useMemo(() => {
    const m = new Map<string, { name: string; items: Absence[]; days: number }>()
    for (const a of yearAbs) {
      const name = a.user?.name ?? '?'
      const e = m.get(name) ?? { name, items: [], days: 0 }
      e.items.push(a)
      if (a.type === 'Congés payés' || a.type === 'RTT') e.days += countWorkdays(a.start_date, a.end_date, a.start_period, a.end_period, boutiqueDayOptions(a.type))
      m.set(name, e)
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [yearAbs])

  const types = Array.from(new Set(yearAbs.map(a => a.type)))
  const title = `Planning des congés et absences ${year}${shop ? ` — ${shop}` : ''}`

  const Legend = () => (
    <div className="mt-2" style={{ fontSize: '8.5px' }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {types.map(t => <span key={t} className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ABSENCE_COLORS[t] }} />{t}</span>)}
        <span className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#FECACA', border: '1px solid #F87171' }} />Demande de congés impossible</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#F5D0FE', border: '1px solid #E879F9' }} />Jour férié</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#E5E7EB' }} />Dimanche</span>
        <span className="text-gray-500">Pastille pâle = en attente de validation</span>
      </div>
      {layout !== 'lignes' && codes.size > 0 && (
        <p className="mt-1 text-gray-700"><strong>Initiales :</strong> {Array.from(codes.entries()).map(([n, c]) => `${c} = ${n}`).join(' · ')}</p>
      )}
    </div>
  )

  const PageTitle = ({ part }: { part?: string }) => (
    <div className="flex items-end justify-between mb-1.5">
      <h1 className="text-lg font-extrabold leading-tight">{title}{part ? <span className="text-gray-500 font-semibold text-sm"> · {part}</span> : null}</h1>
      <p className="text-[9px] text-gray-500">Imprimé le {new Date().toLocaleDateString('fr-FR')}</p>
    </div>
  )

  // ── Mise en page « mois en colonnes » : 6 mois par page, les jours en lignes (de haut en bas) ──
  const columnsPage = (half: 0 | 1) => {
    const months = Array.from({ length: 6 }, (_, i) => half * 6 + i)
    return (
      <section key={half} className="annual-page bg-white text-black rounded-lg border border-border p-4 print:border-0 print:p-0 print:rounded-none mb-6 print:mb-0">
        <PageTitle part={half === 0 ? 'Janvier à juin' : 'Juillet à décembre'} />
        <table className="w-full border-collapse table-fixed" style={{ fontSize: '7px' }}>
          <thead><tr>
            <th className="w-[18px] border border-gray-300 bg-gray-100" />
            {months.map(m => <th key={m} className="border border-gray-300 bg-gray-100 py-0.5 text-[9px] font-bold">{MONTHS[m]}</th>)}
          </tr></thead>
          <tbody>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <tr key={d} style={{ height: '5.1mm' }}>
                <th className="border border-gray-300 bg-gray-100 text-[7.5px] font-semibold text-center">{d}</th>
                {months.map(m => {
                  if (d > new Date(year, m + 1, 0).getDate()) return <td key={m} className="border border-gray-200 bg-gray-50" />
                  const x = dayInfo(m, d)
                  return (
                    <td key={m} className="border border-gray-300 p-0 overflow-hidden" style={{ backgroundColor: x.bg }} title={x.title}>
                      <div className="flex items-center gap-[2px] px-[2px] h-full overflow-hidden">
                        <span className="w-[8px] flex-shrink-0 text-center font-semibold" style={{ fontSize: '6px', color: '#6B7280' }}>{WEEKDAY_LETTER[x.wd]}</span>
                        {x.ferie && <span className="truncate text-[5.5px] text-fuchsia-800 max-w-[34%]">{x.ferie}</span>}
                        {x.list.slice(0, 5).map(a => <Badge key={a.id} a={a} size={5.8} />)}
                        {x.list.length > 5 && <span className="font-bold" style={{ fontSize: '5.5px' }}>+{x.list.length - 5}</span>}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <Legend />
      </section>
    )
  }

  // ── Mise en page « calendriers mensuels » : 6 grilles de mois par page (3 × 2) ──
  const gridsPage = (half: 0 | 1) => {
    const months = Array.from({ length: 6 }, (_, i) => half * 6 + i)
    return (
      <section key={half} className="annual-page bg-white text-black rounded-lg border border-border p-4 print:border-0 print:p-0 print:rounded-none mb-6 print:mb-0">
        <PageTitle part={half === 0 ? 'Janvier à juin' : 'Juillet à décembre'} />
        <div className="grid grid-cols-3 gap-x-3 gap-y-2">
          {months.map(m => {
            const dim = new Date(year, m + 1, 0).getDate()
            const offset = (new Date(year, m, 1).getDay() + 6) % 7
            const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]
            while (cells.length % 7 !== 0) cells.push(null)
            return (
              <div key={m}>
                <p className="text-center font-bold bg-gray-100 border border-gray-300 border-b-0 py-0.5" style={{ fontSize: '10px' }}>{MONTHS[m]} {year}</p>
                <table className="w-full border-collapse table-fixed">
                  <thead><tr>{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, i) => <th key={i} className="border border-gray-300 bg-gray-50 text-[7px] py-px">{l}</th>)}</tr></thead>
                  <tbody>
                    {Array.from({ length: cells.length / 7 }, (_, r) => (
                      <tr key={r} style={{ height: '11mm' }}>
                        {cells.slice(r * 7, r * 7 + 7).map((d, c) => {
                          if (!d) return <td key={c} className="border border-gray-200 bg-gray-50" />
                          const x = dayInfo(m, d)
                          return (
                            <td key={c} className="border border-gray-300 align-top p-0 overflow-hidden" style={{ backgroundColor: x.bg }} title={x.title}>
                              <div className="font-semibold leading-none px-[2px] pt-[1px]" style={{ fontSize: '7px', color: '#374151' }}>{d}</div>
                              <div className="flex flex-wrap gap-[1px] px-[1px] pt-[1px]">
                                {x.list.slice(0, 4).map(a => <Badge key={a.id} a={a} size={5.8} />)}
                                {x.list.length > 4 && <span className="font-bold" style={{ fontSize: '5.5px' }}>+{x.list.length - 4}</span>}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
        <Legend />
      </section>
    )
  }

  // ── Mise en page « mois en lignes » (planning) + page de récapitulatif ──
  const rowsPages = (
    <>
      <section className="annual-page bg-white text-black rounded-lg border border-border p-4 print:border-0 print:p-0 print:rounded-none mb-6 print:mb-0">
        <PageTitle />
        <table className="w-full border-collapse table-fixed" style={{ fontSize: '7px' }}>
          <thead>
            <tr>
              <th className="w-[44px] border border-gray-300 bg-gray-100 text-left px-1 py-0.5 text-[8px]">Mois</th>
              {Array.from({ length: 31 }, (_, i) => <th key={i} className="border border-gray-300 bg-gray-100 text-center py-0.5 text-[8px] font-semibold">{i + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((label, m) => {
              const dim = new Date(year, m + 1, 0).getDate()
              return (
                <tr key={m} style={{ height: '13.2mm' }}>
                  <th className="border border-gray-300 bg-gray-100 text-left px-1 text-[8.5px] font-bold align-middle">{label}</th>
                  {Array.from({ length: 31 }, (_, i) => {
                    const d = i + 1
                    if (d > dim) return <td key={i} className="border border-gray-200 bg-gray-50" />
                    const x = dayInfo(m, d)
                    return (
                      <td key={i} className="border border-gray-300 align-top p-0 overflow-hidden" style={{ backgroundColor: x.bg }} title={x.title}>
                        <div className="leading-none px-[1px]" style={{ fontSize: '5.5px', color: '#6B7280' }}>{WEEKDAY_LETTER[x.wd]}</div>
                        <div className="flex flex-col gap-[0.5px] px-[0.5px]">
                          {x.list.slice(0, 3).map(a => <Badge key={a.id} a={a} size={5.6} />)}
                          {x.list.length > 3 && <span className="text-center font-bold leading-none" style={{ fontSize: '5.5px', color: '#374151' }}>+{x.list.length - 3}</span>}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        <Legend />
      </section>

      <section className="annual-page bg-white text-black rounded-lg border border-border p-4 print:border-0 print:p-0 print:rounded-none">
        <h2 className="text-lg font-extrabold mb-2">Récapitulatif {year}{shop ? ` — ${shop}` : ''}</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Par collaborateur</h3>
            {recap.length === 0 ? <p className="text-sm text-gray-500">Aucune absence enregistrée sur {year}.</p> : (
              <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
                <thead><tr className="bg-gray-100">
                  <th className="border border-gray-300 px-1.5 py-1 text-left w-[26px]">Init.</th>
                  <th className="border border-gray-300 px-1.5 py-1 text-left w-[22%]">Collaborateur</th>
                  <th className="border border-gray-300 px-1.5 py-1 text-left">Périodes</th>
                  <th className="border border-gray-300 px-1.5 py-1 text-right w-[44px]">Jours</th>
                </tr></thead>
                <tbody>
                  {recap.map(r => (
                    <tr key={r.name} style={{ breakInside: 'avoid' }}>
                      <td className="border border-gray-300 px-1.5 py-1 font-bold align-top">{codes.get(r.name)}</td>
                      <td className="border border-gray-300 px-1.5 py-1 font-semibold align-top">{r.name}</td>
                      <td className="border border-gray-300 px-1.5 py-1 align-top">
                        {r.items.sort((a, b) => a.start_date.localeCompare(b.start_date)).map(a => (
                          <span key={a.id} className="inline-block mr-2 whitespace-nowrap">
                            <i className="inline-block w-2 h-2 rounded-sm mr-0.5 align-middle" style={{ backgroundColor: ABSENCE_COLORS[a.type] }} />
                            {a.start_date === a.end_date ? fmt(a.start_date) : `${fmt(a.start_date)} → ${fmt(a.end_date)}`}
                            {a.status.includes('attente') ? ' (en attente)' : ''}
                          </span>
                        ))}
                      </td>
                      <td className="border border-gray-300 px-1.5 py-1 text-right font-semibold align-top tabular-nums">{r.days ? String(r.days).replace('.', ',') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-1 text-gray-500" style={{ fontSize: '8px' }}>Jours = congés payés et RTT décomptés (samedis compris, 5 jours au plus par semaine).</p>
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Périodes où la demande de congés est impossible</h3>
            {yearBlocked.length === 0 ? <p className="text-sm text-gray-500">Aucune.</p> : (
              <ul style={{ fontSize: '9px' }} className="space-y-1">
                {yearBlocked.map((p, i) => (
                  <li key={i} className="flex gap-2"><i className="inline-block w-2.5 h-2.5 rounded-sm mt-[2px] flex-shrink-0" style={{ backgroundColor: '#FECACA', border: '1px solid #F87171' }} />
                    <span><strong>{fmt(p.start)} → {fmt(p.end)}</strong> — {p.label}</span></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </>
  )

  return (
    <div className="annual max-w-[1400px] mx-auto">
      {/* Mise en page d'impression : A4 paysage, 2 pages, marges réduites */}
      <style>{`
        @page { size: A4 landscape; margin: 7mm; }
        @media print {
          html, body { background: #fff !important; }
          .annual { max-width: none !important; }
          .annual-page { break-after: page; page-break-after: always; }
          .annual-page:last-child { break-after: auto; page-break-after: auto; }
          .annual * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-3 print:hidden">
        <Link href="/conges" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Retour aux congés</Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="p-2 rounded-lg border border-border hover:bg-muted" aria-label="Année précédente"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-lg font-extrabold tabular-nums w-16 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="p-2 rounded-lg border border-border hover:bg-muted" aria-label="Année suivante"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ backgroundColor: 'var(--accent)' }}>
            <Printer className="w-4 h-4" /> Imprimer (2 pages)
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Mise en page</span>
        {LAYOUTS.map(l => (
          <button key={l.id} onClick={() => pick(l.id)} title={l.hint}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${layout === l.id ? 'text-white border-transparent' : 'border-border hover:bg-muted'}`}
            style={layout === l.id ? { backgroundColor: 'var(--accent)' } : {}}>
            {l.label}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-1">{LAYOUTS.find(l => l.id === layout)?.hint}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : layout === 'colonnes' ? (<>{columnsPage(0)}{columnsPage(1)}</>)
        : layout === 'grilles' ? (<>{gridsPage(0)}{gridsPage(1)}</>)
        : rowsPages}
    </div>
  )
}
