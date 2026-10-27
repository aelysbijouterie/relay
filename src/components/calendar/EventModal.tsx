'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, Trash2, UserPlus } from 'lucide-react'
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
  // Invités nommés : on choisit des personnes précises, pas forcément tout le service.
  const [attendees, setAttendees] = useState<{ id: string; name: string }[]>(event?.attendees ?? [])
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [query, setQuery] = useState('')
  const readOnly = editing && event?.is_mine === false

  useEffect(() => {
    fetch('/api/profiles', { cache: 'no-store' }).then(r => r.json())
      .then((d: { id: string; name: string }[]) => setPeople(Array.isArray(d) ? d.map(p => ({ id: p.id, name: p.name })) : []))
      .catch(() => {})
  }, [])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const chosen = new Set(attendees.map(a => a.id))
    return people.filter(p => !chosen.has(p.id) && p.name.toLowerCase().includes(q)).slice(0, 6)
  }, [people, query, attendees])

  async function submit() {
    if (!title.trim()) { toast.error('Indiquez un titre'); return }
    setSaving(true)
    const payload = {
      title: title.trim(), event_date: eventDate, event_time: eventTime || null,
      note: note.trim() || null, category, is_recurring_yearly: recurring, is_shared: shared,
      attendee_ids: attendees.map(a => a.id),
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

  // Événement créé par quelqu'un d'autre (invité ou service) : lecture seule.
  if (readOnly && event) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="bg-card rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} style={{ boxShadow: '0 30px 80px rgba(20,30,40,0.2)' }}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-lg font-extrabold tracking-tight">{event.title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-sm text-muted-foreground mb-4 capitalize">
            {new Date(event.event_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ''}
          </p>
          {event.note && <p className="text-sm whitespace-pre-wrap mb-4">{event.note}</p>}
          {(event.attendees?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Invités</p>
              <div className="flex flex-wrap gap-1.5">
                {event.attendees!.map(a => <span key={a.id} className="text-xs px-2 py-1 rounded-full bg-muted">{a.name}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>
    )
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

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Inviter des personnes (optionnel)
            </label>
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {attendees.map(a => (
                  <span key={a.id} className="inline-flex items-center gap-1 text-xs pl-2.5 pr-1 py-1 rounded-full bg-muted">
                    {a.name}
                    <button type="button" onClick={() => setAttendees(prev => prev.filter(x => x.id !== a.id))}
                      className="p-0.5 rounded-full hover:bg-background" aria-label={`Retirer ${a.name}`}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un collègue…"
              className="w-full mt-2 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
            {suggestions.length > 0 && (
              <div className="mt-1 border border-border rounded-lg overflow-hidden">
                {suggestions.map(p => (
                  <button key={p.id} type="button" onClick={() => { setAttendees(prev => [...prev, p]); setQuery('') }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors">{p.name}</button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1.5">Les personnes invitées voient l&apos;événement dans leur calendrier et reçoivent un e-mail.</p>
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
