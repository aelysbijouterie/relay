'use client'

import { useEffect, useState } from 'react'
import { RotateCcw, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { getInitials, formatDeadline } from '@/lib/utils'
import { PRIORITY_COLORS } from '@/types'

interface TrashTask {
  id: string
  title: string
  status: string
  priority: keyof typeof PRIORITY_COLORS
  deadline: string | null
  deleted_at: string
  department?: { id: string; name: string; color: string } | null
  assignees?: { id: string; name: string; avatar_url?: string | null }[]
}

export function TrashView() {
  const [tasks, setTasks]     = useState<TrashTask[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/tasks/trash', { cache: 'no-store' })
      const d = await r.json()
      setTasks(Array.isArray(d) ? d : [])
    } catch { setTasks([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function restore(id: string) {
    setBusy(id)
    try {
      const r = await fetch(`/api/tasks/${id}/restore`, { method: 'POST' })
      if (!r.ok) throw new Error()
      setTasks(prev => prev.filter(t => t.id !== id))
      toast.success('Carte restaurée')
    } catch { toast.error('Restauration impossible') }
    finally { setBusy(null) }
  }

  async function destroy(id: string) {
    setBusy(id)
    try {
      const r = await fetch(`/api/tasks/${id}?permanent=1`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      setTasks(prev => prev.filter(t => t.id !== id))
      toast.success('Carte supprimée définitivement')
    } catch { toast.error('Suppression impossible') }
    finally { setBusy(null); setConfirmId(null) }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Trash2 className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-extrabold tracking-tight">Corbeille</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Les cartes supprimées sont conservées ici. Tu peux les restaurer ou les supprimer définitivement.
      </p>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">La corbeille est vide.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tasks.map(task => {
            const deptColor = task.department?.color ?? '#94A3B8'
            return (
              <div key={task.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: deptColor }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[0.65rem] px-2 py-0.5 rounded-md font-bold"
                      style={{ backgroundColor: `${PRIORITY_COLORS[task.priority]}1A`, color: PRIORITY_COLORS[task.priority] }}>
                      {task.priority}
                    </span>
                    {task.department && (
                      <span className="text-[0.65rem] px-2 py-0.5 rounded-md font-semibold text-white" style={{ backgroundColor: deptColor }}>
                        {task.department.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Supprimée {formatDeadline(task.deleted_at)}
                  </p>
                </div>

                {confirmId === task.id ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-red-500 font-medium hidden sm:flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Définitif ?
                    </span>
                    <button onClick={() => destroy(task.id)} disabled={busy === task.id}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                      {busy === task.id ? '…' : 'Oui, supprimer'}
                    </button>
                    <button onClick={() => setConfirmId(null)}
                      className="px-2.5 py-1.5 rounded-lg text-xs border border-border hover:bg-muted transition-colors">Annuler</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => restore(task.id)} disabled={busy === task.id}
                      title="Restaurer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors disabled:opacity-50">
                      <RotateCcw className="w-3.5 h-3.5" /> Restaurer
                    </button>
                    <button onClick={() => setConfirmId(task.id)} disabled={busy === task.id}
                      title="Supprimer définitivement"
                      className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
