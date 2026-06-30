'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ABSENCE_TYPES, ABSENCE_COLORS, type AbsenceType, type AbsencePeriod } from '@/types/absences'

export function NewAbsenceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<AbsenceType>('Congés payés')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startPeriod, setStartPeriod] = useState<AbsencePeriod>('full')
  const [endPeriod, setEndPeriod] = useState<AbsencePeriod>('full')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const sameDay = startDate && endDate && startDate === endDate

  async function submit() {
    if (!startDate || !endDate) { toast.error('Indique les dates'); return }
    if (new Date(endDate) < new Date(startDate)) { toast.error('La date de fin doit être après le début'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/absences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, start_date: startDate, end_date: endDate,
          start_period: startPeriod, end_period: sameDay ? startPeriod : endPeriod,
          reason,
        }),
      })
      if (!r.ok) throw new Error()
      // Notifie le(s) responsable(s) du service
      fetch('/api/notify/absence-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, start_date: startDate, end_date: endDate }),
      }).catch(() => {})
      toast.success('Demande envoyée')
      onCreated()
    } catch { toast.error('Envoi impossible'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 30px 80px rgba(20,30,40,0.2)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold tracking-tight">Poser une demande</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          {/* Type */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type d'absence</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {ABSENCE_TYPES.map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all text-left ${type === t ? 'text-white border-transparent' : 'border-border hover:bg-muted'}`}
                  style={type === t ? { backgroundColor: ABSENCE_COLORS[t] } : {}}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
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

          {/* Demi-journées */}
          <div className={sameDay ? '' : 'grid grid-cols-2 gap-3'}>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{sameDay ? 'Période' : 'Premier jour'}</label>
              <select value={startPeriod} onChange={e => setStartPeriod(e.target.value as AbsencePeriod)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground">
                <option value="full">Journée entière</option>
                <option value="am">Matin</option>
                <option value="pm">Après-midi</option>
              </select>
            </div>
            {!sameDay && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dernier jour</label>
                <select value={endPeriod} onChange={e => setEndPeriod(e.target.value as AbsencePeriod)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground">
                  <option value="full">Journée entière</option>
                  <option value="am">Matin</option>
                  <option value="pm">Après-midi</option>
                </select>
              </div>
            )}
          </div>

          {/* Motif */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motif (optionnel)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground resize-none"
              placeholder="Une précision si besoin…" />
          </div>

          <button onClick={submit} disabled={saving}
            className="w-full py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: 'var(--accent)' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Envoyer la demande'}
          </button>
        </div>
      </div>
    </div>
  )
}
