'use client'

import { useState } from 'react'
import { X, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CATEGORY_LABELS, type EventCategory, type CalendarEvent, dsLocal } from '@/types/calendarEvents'

export function EventModal({
  defaultDate, event, onClose, onSaved,
}: {
  defaultDate?: Date
  event?: CalendarEvent | null
  onClose: () => void
  onSaved: () => void
}) {
  const editing = !!event
  const [title, setTitle] = useState(event?.title ?? '')
  const [eventDate, setEventDate] = useState(event?.event_date ?? (defaultDate ? dsLocal(defaultDate) : dsLocal(new Date())))
  const [eventTime, setEventTime] = useState(event?.event_time?.slice(0, 5) ?? '')
  const [note, setNote] = useState(event?.note ?? '')
  const [category, setCategory] = useState<EventCategory>(event?.category ?? 'autre')
  const [recurring, setRecurring] = useState(event?.is_recurring_yearly ?? false)
  const [shared, setShared] = useState(event?.is_shared ?? false)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!title.trim()) { toast.error('Indiquez un titre'); return }
    setSaving(true)
    const payload = {
      title: title.trim(), event_date: eventDate, event_time: eventTime || null,
      note: note.trim() || null, category, is_recurring_yearly: recurring, is_shared: shared,
    }
    try {
      const res = editing
        ? await fetch(`/api/calendar-events/${event!.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/calendar-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      toast.success(editing ? 'Événement modifié' : 'Événement créé')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
      setSaving(false)
    }
  }

  async function remove() {
    if (!event || !confirm('Supprimer cet événement ?')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/calendar-events/${event.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Événement supprimé')
      onSaved()
    } catch { toast.error('Suppression impossible'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} style={{ boxShadow: '0 30px 80px rgba(20,30,40,0.2)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold tracking-tight">{editing ? 'Modifier l\'événement' : 'Nouvel événement'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Titre</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex : Réunion équipe, Anniversaire de Chloé…"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</label>
              <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Heure (optionnel)</label>
              <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Catégorie</label>
            <select value={category} onChange={e => setCategory(e.target.value as EventCategory)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground">
              {(Object.keys(CATEGORY_LABELS) as EventCategory[]).map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Note (optionnel)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground resize-none" />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm">Se répète chaque année (ex : anniversaire)</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm">Partagé avec mon service (sinon, visible par vous seul)</span>
          </label>

          <div className="flex gap-2 pt-1">
            {editing && (
              <button onClick={remove} disabled={saving} className="p-2.5 rounded-xl border border-border hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={submit} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-transform hover:scale-[1.01]"
              style={{ backgroundColor: 'var(--accent)' }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editing ? 'Enregistrer' : 'Créer l\'événement'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
