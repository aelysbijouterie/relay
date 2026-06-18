'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArchiveRestore, Trash2, Loader2, Archive } from 'lucide-react'
import type { Task } from '@/types'

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then(r => r.json()).then(d => (Array.isArray(d) ? d : []))

export function ArchivesView() {
  const { data: tasks, isLoading, mutate } = useSWR<Task[]>('/api/tasks/archived', fetcher)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function restore(taskId: string) {
    setBusy(taskId)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Terminé' }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Carte restaurée (statut Terminé)')
      mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  async function remove(taskId: string) {
    setBusy(taskId)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Carte supprimée définitivement')
      mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(null)
      setConfirmDelete(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Archive className="w-5 h-5 text-muted-foreground" />
        <div>
          <h1 className="font-heading text-2xl font-bold">Archives</h1>
          <p className="text-sm text-muted-foreground">Cartes archivées de votre périmètre</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <p className="text-4xl mb-3">🗄️</p>
          <p className="font-medium">Aucune carte archivée</p>
          <p className="text-sm mt-1">Les cartes archivées apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className="glass-card p-4 flex items-center gap-4">
              <span className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: task.department?.color ?? '#94A3B8' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.department?.name}
                  {task.completed_at && ` · terminée le ${format(parseISO(task.completed_at), 'd MMM yyyy', { locale: fr })}`}
                </p>
                {task.tags && task.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1.5">
                    {task.tags.map(tag => (
                      <span key={tag.id} className="text-[0.65rem] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}55` }}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {confirmDelete === task.id ? (
                  <>
                    <span className="text-xs text-muted-foreground mr-1">Sûr ?</span>
                    <button onClick={() => remove(task.id)} disabled={busy === task.id}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                      {busy === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Supprimer'}
                    </button>
                    <button onClick={() => setConfirmDelete(null)}
                      className="px-2.5 py-1.5 rounded-lg text-xs border border-border hover:bg-muted transition-colors">Non</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => restore(task.id)} disabled={busy === task.id}
                      title="Restaurer" className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                      {busy === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArchiveRestore className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setConfirmDelete(task.id)} disabled={busy === task.id}
                      title="Supprimer définitivement" className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}