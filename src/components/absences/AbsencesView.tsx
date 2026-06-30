'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check, X, Clock, Loader2, CalendarDays, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getInitials } from '@/lib/utils'
import { ABSENCE_COLORS, ABSENCE_STATUS_COLORS, PERIOD_LABELS, type Absence } from '@/types/absences'
import { NewAbsenceModal } from './NewAbsenceModal'

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

interface Me { id: string; role: string; department_id: string | null }

export function AbsencesView() {
  const [absences, setAbsences] = useState<Absence[]>([])
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [showNew, setShowNew] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, mRes] = await Promise.all([
        fetch('/api/absences', { cache: 'no-store' }),
        fetch('/api/account', { cache: 'no-store' }),
      ])
      const aData = await aRes.json()
      const mData = await mRes.json()
      setAbsences(Array.isArray(aData) ? aData : [])
      setMe(mData?.id ? { id: mData.id, role: mData.role, department_id: mData.department_id } : null)
    } catch { /* noop */ }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // Demandes que JE peux valider : en attente, de mon service, si je suis manager/admin.
  const toReview = useMemo(() => {
    if (!me) return []
    if (me.role !== 'manager' && me.role !== 'admin') return []
    return absences.filter(a =>
      a.status === 'En attente' &&
      a.user_id !== me.id &&
      (me.role === 'admin' || a.user?.department_id === me.department_id)
    )
  }, [absences, me])

  async function review(id: string, status: 'Validé' | 'Refusé') {
    setBusyId(id)
    try {
      const r = await fetch(`/api/absences/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!r.ok) throw new Error()
      toast.success(status === 'Validé' ? 'Demande validée' : 'Demande refusée')
      // Email de notification au demandeur
      fetch('/api/notify/absence-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absenceId: id, status }),
      }).catch(() => {})
      load()
    } catch { toast.error('Action impossible') }
    finally { setBusyId(null) }
  }

  async function cancelAbsence(id: string) {
    setBusyId(id)
    try {
      const r = await fetch(`/api/absences/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      setAbsences(prev => prev.filter(a => a.id !== id))
      toast.success('Demande annulée')
    } catch { toast.error('Annulation impossible') }
    finally { setBusyId(null) }
  }

  // Construction de la grille du mois
  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const startDay = (first.getDay() + 6) % 7 // lundi = 0
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < startDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.y, cursor.m, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [cursor])

  // Absences validées ou en attente qui touchent une date donnée
  function absencesOn(date: Date): Absence[] {
    const ds = date.toISOString().slice(0, 10)
    return absences.filter(a => a.status !== 'Refusé' && ds >= a.start_date && ds <= a.end_date)
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  function prevMonth() { setCursor(c => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }) }
  function nextMonth() { setCursor(c => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }) }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-2xl font-extrabold tracking-tight">Congés &amp; absences</h1>
        </div>
        <button onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: 'var(--accent)' }}>
          <Plus className="w-4 h-4" /> Poser une demande
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Visualisez les absences de l'équipe et posez vos demandes.</p>

      {/* Demandes à valider (responsables seulement) */}
      {toReview.length > 0 && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-amber-700 dark:text-amber-400">{toReview.length} demande{toReview.length > 1 ? 's' : ''} à valider</h2>
          </div>
          <div className="space-y-2">
            {toReview.map(a => (
              <div key={a.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: ABSENCE_COLORS[a.type] }}>{getInitials(a.user?.name ?? '?')}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.user?.name} · <span style={{ color: ABSENCE_COLORS[a.type] }}>{a.type}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {fmtRange(a)} {a.reason && <>· {a.reason}</>}
                  </p>
                </div>
                <button onClick={() => review(a.id, 'Validé')} disabled={busyId === a.id}
                  className="p-2 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors disabled:opacity-50" title="Valider">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => review(a.id, 'Refusé')} disabled={busyId === a.id}
                  className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50" title="Refuser">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendrier mensuel */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="text-lg font-bold">{MONTHS[cursor.m]} {cursor.y}</h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS.map(d => <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((date, i) => {
                if (!date) return <div key={i} className="aspect-square" />
                const ds = date.toISOString().slice(0, 10)
                const items = absencesOn(date)
                const isToday = ds === todayStr
                const isWeekend = (date.getDay() === 0 || date.getDay() === 6)
                return (
                  <div key={i} className={`aspect-square rounded-lg border p-1 overflow-hidden ${isToday ? 'border-2' : 'border-border'} ${isWeekend ? 'bg-muted/30' : ''}`}
                    style={isToday ? { borderColor: 'var(--accent)' } : {}}>
                    <div className={`text-xs font-semibold mb-0.5 ${isToday ? '' : 'text-muted-foreground'}`} style={isToday ? { color: 'var(--accent)' } : {}}>{date.getDate()}</div>
                    <div className="space-y-0.5">
                      {items.slice(0, 3).map(a => (
                        <div key={a.id} title={`${a.user?.name} · ${a.type}${a.status === 'En attente' ? ' (en attente)' : ''}`}
                          className="text-[0.55rem] leading-tight px-1 py-0.5 rounded truncate text-white font-medium"
                          style={{ backgroundColor: ABSENCE_COLORS[a.type], opacity: a.status === 'En attente' ? 0.5 : 1 }}>
                          {(a.user?.name ?? '?').split(' ')[0]}
                        </div>
                      ))}
                      {items.length > 3 && <div className="text-[0.55rem] text-muted-foreground px-1">+{items.length - 3}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Légende */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-border">
          {Object.entries(ABSENCE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
              <span className="text-xs text-muted-foreground">{type}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">En attente (translucide)</span>
          </div>
        </div>
      </div>

      {/* Mes demandes */}
      {me && (
        <div className="mt-6">
          <h2 className="text-sm font-bold mb-3">Mes demandes</h2>
          <div className="space-y-2">
            {absences.filter(a => a.user_id === me.id).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>
            ) : absences.filter(a => a.user_id === me.id).map(a => (
              <div key={a.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: ABSENCE_COLORS[a.type] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{a.type}</p>
                  <p className="text-xs text-muted-foreground">{fmtRange(a)}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-md font-semibold text-white" style={{ backgroundColor: ABSENCE_STATUS_COLORS[a.status] }}>{a.status}</span>
                {a.status === 'En attente' && (
                  <button onClick={() => cancelAbsence(a.id)} disabled={busyId === a.id}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50" title="Annuler">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showNew && <NewAbsenceModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />}
    </div>
  )
}

function fmtRange(a: Absence): string {
  const f = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const startP = a.start_period !== 'full' ? ` (${PERIOD_LABELS[a.start_period]})` : ''
  const endP = a.end_period !== 'full' ? ` (${PERIOD_LABELS[a.end_period]})` : ''
  if (a.start_date === a.end_date) return `${f(a.start_date)}${startP}`
  return `${f(a.start_date)}${startP} → ${f(a.end_date)}${endP}`
}
