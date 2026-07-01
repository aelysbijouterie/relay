'use client'

import { useState } from 'react'
import { X, Loader2, Trash2, Ban, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { ActivityPeriod } from '@/types/absences'

export function ActivityPeriodModal({ periods, onClose, onChange }: {
  periods: ActivityPeriod[]; onClose: () => void; onChange: () => void
}) {
  const [label, setLabel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function add() {
    if (!startDate || !endDate) { toast.error('Indique les dates'); return }
    if (new Date(endDate) < new Date(startDate)) { toast.error('Fin avant début'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/activity-periods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, start_date: startDate, end_date: endDate }),
      })
      if (!r.ok) throw new Error()
      toast.success('Période ajoutée')
      setLabel(''); setStartDate(''); setEndDate('')
      onChange()
    } catch { toast.error('Ajout impossible') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    setBusyId(id)
    try {
      const r = await fetch(`/api/activity-periods/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      toast.success('Période supprimée')
      onChange()
    } catch { toast.error('Suppression impossible') }
    finally { setBusyId(null) }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 30px 80px rgba(20,30,40,0.2)' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2"><Ban className="w-5 h-5 text-red-500" /> Périodes d'activité</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-5">Marquez des périodes où poser des congés est déconseillé pour votre service (affichées en rouge sur le calendrier).</p>

        {/* Liste existante */}
        {periods.length > 0 && (
          <div className="space-y-2 mb-5">
            {periods.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-muted/40 border border-border rounded-lg p-2.5">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {p.label && <p className="text-sm font-medium truncate">{p.label}</p>}
                  <p className="text-xs text-muted-foreground">{fmt(p.start_date)} → {fmt(p.end_date)}</p>
                </div>
                <button onClick={() => remove(p.id)} disabled={busyId === p.id}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}

        {/* Ajout */}
        <div className="space-y-3 border-t border-border pt-4">
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Intitulé (ex : Soldes d'été)"
            className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }}
              className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
            <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
          </div>
          <button onClick={add} disabled={saving}
            className="w-full py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--accent)' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Ajouter la période</>}
          </button>
        </div>
      </div>
    </div>
  )
}
