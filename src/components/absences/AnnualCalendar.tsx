'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Printer, ArrowLeft, Loader2 } from 'lucide-react'
import { holidayName } from '@/lib/calendar/holidays'
import { countWorkdays, boutiqueDayOptions } from '@/lib/absences/workdays'
import { ABSENCE_COLORS, type Absence } from '@/types/absences'

interface BlockedPeriod { label: string; start: string; end: string }

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
 * Planning annuel d'une boutique, imprimable en paysage sur 2 pages A4 :
 *  page 1 = le planning (un mois par ligne, un jour par colonne) ; page 2 = récapitulatif par collaborateur + périodes bloquées.
 */
export function AnnualCalendar() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [absences, setAbsences] = useState<Absence[]>([])
  const [blocked, setBlocked] = useState<BlockedPeriod[]>([])
  const [shop, setShop] = useState('')
  const [loading, setLoading] = useState(true)

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

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 print:hidden">
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

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (<>
        {/* PAGE 1 — planning */}
        <section className="annual-page bg-white text-black rounded-lg border border-border p-4 print:border-0 print:p-0 print:rounded-none mb-6 print:mb-0">
          <div className="flex items-end justify-between mb-2">
            <h1 className="text-xl font-extrabold leading-tight">Planning des congés et absences {year}{shop ? ` — ${shop}` : ''}</h1>
            <p className="text-[10px] text-gray-500">Imprimé le {new Date().toLocaleDateString('fr-FR')}</p>
          </div>
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
                      const date = ds(year, m, d)
                      const wd = new Date(year, m, d).getDay()
                      const ferie = holidayName(date)
                      const bl = blockedLabel(date)
                      const list = byDay.get(date) ?? []
                      const bg = bl ? '#FECACA' : ferie ? '#F5D0FE' : wd === 0 ? '#E5E7EB' : '#FFFFFF'
                      return (
                        <td key={i} className="border border-gray-300 align-top p-0 overflow-hidden" style={{ backgroundColor: bg }}
                          title={[ferie, bl ? `Demande impossible : ${bl}` : null, ...list.map(a => `${a.user?.name} · ${a.type}`)].filter(Boolean).join('\n')}>
                          <div className="flex items-center justify-between px-[1px] leading-none" style={{ fontSize: '5.5px', color: '#6B7280' }}>
                            <span>{WEEKDAY_LETTER[wd]}</span>
                          </div>
                          <div className="flex flex-col gap-[0.5px] px-[0.5px]">
                            {list.slice(0, 3).map(a => (
                              <span key={a.id} className="block text-center font-bold text-white leading-[1.25] rounded-[1px]"
                                style={{ fontSize: '5.6px', backgroundColor: ABSENCE_COLORS[a.type], opacity: a.status.includes('attente') ? 0.55 : 1 }}>
                                {codes.get(a.user?.name ?? '?')}
                              </span>
                            ))}
                            {list.length > 3 && <span className="text-center font-bold leading-none" style={{ fontSize: '5.5px', color: '#374151' }}>+{list.length - 3}</span>}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2" style={{ fontSize: '8.5px' }}>
            {types.map(t => <span key={t} className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ABSENCE_COLORS[t] }} />{t}</span>)}
            <span className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#FECACA', border: '1px solid #F87171' }} />Demande de congés impossible</span>
            <span className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#F5D0FE', border: '1px solid #E879F9' }} />Jour férié</span>
            <span className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#E5E7EB' }} />Dimanche</span>
            <span className="text-gray-500">Pastille pâle = en attente de validation · lettres = initiales (voir page 2)</span>
          </div>
        </section>

        {/* PAGE 2 — récapitulatif */}
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
      </>)}
    </div>
  )
}
