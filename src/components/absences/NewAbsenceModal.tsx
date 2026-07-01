'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { ABSENCE_TYPES, ABSENCE_COLORS, type AbsenceType, type AbsencePeriod, type Absence } from '@/types/absences'

export function NewAbsenceModal({ absence, onClose, onCreated }: { absence?: Absence | null; onClose: () => void; onCreated: () => void }) {
  const editing = !!absence
  const [type, setType] = useState<AbsenceType>(absence?.type ?? 'Congés payés')
  const [startDate, setStartDate] = useState(absence?.start_date ?? '')
  const [endDate, setEndDate] = useState(absence?.end_date ?? '')
  const [startPeriod, setStartPeriod] = useState<AbsencePeriod>(absence?.start_period ?? 'full')
  const [endPeriod, setEndPeriod] = useState<AbsencePeriod>(absence?.end_period ?? 'full')
  const [reason, setReason] = useState(absence?.reason ?? '')
  const [saving, setSaving] = useState(false)
  const [conflicts, setConflicts] = useState<{ name: string; type: string; start_date: string; end_date: string; status: string }[]>([])

  // Détection de chevauchement dans le même service quand les dates changent.
  useEffect(() => {
    if (!startDate || !endDate) { setConflicts([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/absences/overlap?from=${startDate}&to=${endDate}`, { signal: ctrl.signal })
        const d = await r.json()
        setConflicts(Array.isArray(d.conflicts) ? d.conflicts : [])
      } catch { /* noop */ }
    }, 300)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [startDate, endDate])

  const sameDay = startDate && endDate && startDate === endDate

  async function submit() {
    if (!startDate || !endDate) { toast.error('Indique les dates'); return }
    if (new Date(endDate) < new Date(startDate)) { toast.error('La date de fin doit être après le début'); return }
    setSaving(true)
    try {
      if (editing) {
        // Modification des dates d'une absence validée → demande de modif.
        const r = await fetch(`/api/absences/${absence!.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_date: startDate, end_date: endDate, start_period: startPeriod, end_period: sameDay ? startPeriod : endPeriod }),
        })
        if (!r.ok) throw new Error()
        const res = await r.json()
        if (!res.autoValidated) {
          fetch('/api/notify/absence-request', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, start_date: startDate, end_date: endDate, modification: true }),
          }).catch(() => {})
          toast.success('Demande de modification envoyée')
        } else {
          toast.success('Dates modifiées')
        }
      } else {
        const r = await fetch('/api/absences', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, start_date: startDate, end_date: endDate, start_period: startPeriod, end_period: sameDay ? startPeriod : endPeriod, reason }),
        })
        if (!r.ok) throw new Error()
        const res = await r.json()
        if (!res.autoValidated) {
          fetch('/api/notify/absence-request', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, start_date: startDate, end_date: endDate }),
          }).catch(() => {})
          toast.success('Demande envoyée')
        } else {
          toast.success(type === 'Alternance' ? 'Période enregistrée' : 'Absence enregistrée (validée)')
        }
      }
      onCreated()
    } catch { toast.error('Envoi impossible'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 30px 80px rgba(20,30,40,0.2)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold tracking-tight">{editing ? 'Modifier les dates' : 'Poser une demande'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          {!editing && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type d'absence</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ABSENCE_TYPES.map(t => (
                  <button key={t} onClick={() => setType(t)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all text-left ${type === t ? 'text-white border-transparent' : 'border-border hover:bg-muted'}`}
                    style={type === t ? { backgroundColor: ABSENCE_COLORS[t] } : {}}>{t}</button>
                ))}
              </div>
              {type === 'Alternance' && <p className="text-xs text-muted-foreground mt-2">Les périodes d'alternance sont enregistrées directement, sans validation.</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Du</label>
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Au</label>
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
            </div>
          </div>

          <div className={sameDay ? '' : 'grid grid-cols-2 gap-3'}>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{sameDay ? 'Période' : 'Premier jour'}</label>
              <select value={startPeriod} onChange={e => setStartPeriod(e.target.value as AbsencePeriod)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground">
                <option value="full">Journée entière</option><option value="am">Matin</option><option value="pm">Après-midi</option>
              </select>
            </div>
            {!sameDay && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dernier jour</label>
                <select value={endPeriod} onChange={e => setEndPeriod(e.target.value as AbsencePeriod)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground">
                  <option value="full">Journée entière</option><option value="am">Matin</option><option value="pm">Après-midi</option>
                </select>
              </div>
            )}
          </div>

          {!editing && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motif (optionnel)</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground resize-none"
                placeholder="Une précision si besoin…" />
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="rounded-lg p-3 border" style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#D97706' }} />
                <p className="text-sm font-semibold" style={{ color: '#B45309' }}>
                  {conflicts.length} {conflicts.length > 1 ? 'personnes absentes' : 'personne absente'} dans ton service
                </p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-6">
                {conflicts.slice(0, 4).map((c, i) => (
                  <li key={i}>{c.name} · {c.type}{c.status.includes('attente') ? ' (en attente)' : ''}</li>
                ))}
                {conflicts.length > 4 && <li>+{conflicts.length - 4} autre(s)</li>}
              </ul>
              <p className="text-xs mt-2 ml-6" style={{ color: '#B45309' }}>Tu peux quand même poser ta demande.</p>
            </div>
          )}

          <button onClick={submit} disabled={saving}
            className="w-full py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: 'var(--accent)' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editing ? 'Envoyer la modification' : 'Envoyer la demande'}
          </button>
        </div>
      </div>
    </div>
  )
}
