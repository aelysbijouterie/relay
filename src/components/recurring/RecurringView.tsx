'use client'

import { useState, useEffect, useCallback } from 'react'
import { Repeat, Plus, Trash2, Pencil, Power, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FREQUENCY_LABELS, WEEKDAYS, type RecurringTask } from '@/types/recurring'
import { RecurringModal } from './RecurringModal'

export function RecurringView() {
  const [models, setModels] = useState<RecurringTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editModel, setEditModel] = useState<RecurringTask | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/recurring', { cache: 'no-store' })
      const d = await r.json()
      setModels(Array.isArray(d) ? d : [])
    } catch { /* noop */ }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function toggleActive(m: RecurringTask) {
    setBusyId(m.id)
    try {
      await fetch(`/api/recurring/${m.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !m.is_active }),
      })
      load()
    } catch { toast.error('Action impossible') }
    finally { setBusyId(null) }
  }

  async function remove(id: string) {
    setBusyId(id)
    try {
      const r = await fetch(`/api/recurring/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      setModels(prev => prev.filter(m => m.id !== id))
      toast.success('Modèle supprimé')
    } catch { toast.error('Suppression impossible') }
    finally { setBusyId(null) }
  }

  function describe(m: RecurringTask): string {
    if (m.frequency === 'weekly' && m.weekday != null) return `Chaque ${WEEKDAYS[m.weekday].toLowerCase()}`
    if (m.frequency === 'monthly_day' && m.month_day != null) return `Le ${m.month_day} de chaque mois`
    return FREQUENCY_LABELS[m.frequency]
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Repeat className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-2xl font-extrabold tracking-tight">Cartes récurrentes</h1>
        </div>
        <button onClick={() => { setEditModel(null); setShowModal(true) }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: 'var(--accent)' }}>
          <Plus className="w-4 h-4" /> Nouveau modèle
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Créez des modèles de cartes qui se recréent automatiquement selon la fréquence choisie.</p>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : models.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Repeat className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun modèle récurrent pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {models.map(m => (
            <div key={m.id} className={`bg-card border rounded-xl p-4 flex items-center gap-3 ${m.is_active ? 'border-border' : 'border-border opacity-60'}`}>
              <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: m.department?.color ?? 'var(--accent)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{m.title}</p>
                <p className="text-xs text-muted-foreground">
                  {describe(m)}
                  {m.department && <> · {m.department.name}</>}
                  {!m.is_active && <> · <span className="text-amber-600">en pause</span></>}
                </p>
              </div>
              <button onClick={() => toggleActive(m)} disabled={busyId === m.id}
                className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${m.is_active ? 'text-green-600 hover:bg-green-500/10' : 'text-muted-foreground hover:bg-muted'}`}
                title={m.is_active ? 'Mettre en pause' : 'Réactiver'}><Power className="w-4 h-4" /></button>
              <button onClick={() => { setEditModel(m); setShowModal(true) }}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Modifier"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(m.id)} disabled={busyId === m.id}
                className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {showModal && <RecurringModal model={editModel} onClose={() => { setShowModal(false); setEditModel(null) }} onSaved={() => { setShowModal(false); setEditModel(null); load() }} />}
    </div>
  )
}
