'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FREQUENCY_LABELS, WEEKDAYS, type RecurringTask, type RecurringFrequency } from '@/types/recurring'

interface Member { id: string; name: string; avatar_url?: string | null }
interface Dept { id: string; name: string; color: string }
const PRIORITIES = ['Urgent', 'Élevée', 'Moyenne', 'Faible']

export function RecurringModal({ model, onClose, onSaved }: { model?: RecurringTask | null; onClose: () => void; onSaved: () => void }) {
  const editing = !!model
  const [title, setTitle] = useState(model?.title ?? '')
  const [description, setDescription] = useState(model?.description ?? '')
  const [priority, setPriority] = useState(model?.priority ?? 'Moyenne')
  const [frequency, setFrequency] = useState<RecurringFrequency>(model?.frequency ?? 'weekly')
  const [weekday, setWeekday] = useState<number>(model?.weekday ?? 0)
  const [monthDay, setMonthDay] = useState<number>(model?.month_day ?? 1)
  const [deptId, setDeptId] = useState<string>(model?.department_id ?? '')
  const [assignees, setAssignees] = useState<string[]>(model?.assignee_ids ?? [])
  const [members, setMembers] = useState<Member[]>([])
  const [depts, setDepts] = useState<Dept[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/profiles', { cache: 'no-store' }).then(r => r.json()).then(d => setMembers(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/departments', { cache: 'no-store' }).then(r => r.json()).then(d => setDepts(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  async function submit() {
    if (!title.trim()) { toast.error('Indique un titre'); return }
    setSaving(true)
    const payload = {
      title, description, priority, frequency,
      weekday: frequency === 'weekly' ? weekday : null,
      month_day: frequency === 'monthly_day' ? monthDay : null,
      department_id: deptId || null, assignee_ids: assignees,
    }
    try {
      const r = editing
        ? await fetch(`/api/recurring/${model!.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/recurring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!r.ok) throw new Error()
      toast.success(editing ? 'Modèle modifié' : 'Modèle créé')
      onSaved()
    } catch { toast.error('Enregistrement impossible'); setSaving(false) }
  }

  function toggleAssignee(id: string) {
    setAssignees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 30px 80px rgba(20,30,40,0.2)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold tracking-tight">{editing ? 'Modifier le modèle' : 'Nouveau modèle récurrent'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Titre de la carte</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex : Point hebdo équipe"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description (optionnel)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground resize-none" />
          </div>

          {/* Fréquence */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fréquence</label>
            <select value={frequency} onChange={e => setFrequency(e.target.value as RecurringFrequency)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground">
              {(Object.keys(FREQUENCY_LABELS) as RecurringFrequency[]).map(f => (
                <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
              ))}
            </select>
          </div>

          {/* Paramètre selon la fréquence */}
          {frequency === 'weekly' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jour de la semaine</label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {WEEKDAYS.slice(0, 5).map((d, i) => (
                  <button key={i} onClick={() => setWeekday(i)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${weekday === i ? 'text-white border-transparent' : 'border-border hover:bg-muted'}`}
                    style={weekday === i ? { backgroundColor: 'var(--accent)' } : {}}>{d}</button>
                ))}
              </div>
            </div>
          )}
          {frequency === 'monthly_day' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jour du mois</label>
              <input type="number" min={1} max={31} value={monthDay} onChange={e => setMonthDay(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground" />
              <p className="text-xs text-muted-foreground mt-1">Si le mois est plus court (ex : 31 en février), la carte est créée le dernier jour.</p>
            </div>
          )}

          {/* Priorité + Service */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priorité</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground">
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Service</label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground">
                <option value="">Aucun</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Assignés */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigner à (optionnel)</label>
            <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
              {members.map(m => (
                <button key={m.id} onClick={() => toggleAssignee(m.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${assignees.includes(m.id) ? 'text-white border-transparent' : 'border-border hover:bg-muted'}`}
                  style={assignees.includes(m.id) ? { backgroundColor: 'var(--accent)' } : {}}>{m.name}</button>
              ))}
            </div>
          </div>

          <button onClick={submit} disabled={saving}
            className="w-full py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: 'var(--accent)' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editing ? 'Enregistrer' : 'Créer le modèle'}
          </button>
        </div>
      </div>
    </div>
  )
}
