'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { REFUSAL_REASONS } from '@/types/absences'

/**
 * Refus d'une (ou plusieurs) demande(s) : motif choisi dans une liste + commentaire libre
 * à transmettre au collaborateur. « Autre » impose un commentaire.
 */
export function RefuseDialog({ count, busy, onCancel, onConfirm }: {
  count: number
  busy: boolean
  onCancel: () => void
  onConfirm: (note: string) => void
}) {
  const [reason, setReason] = useState<string>(REFUSAL_REASONS[0])
  const [comment, setComment] = useState('')
  const needsComment = reason === 'Autre'
  const valid = !needsComment || comment.trim().length > 0

  function submit() {
    if (!valid || busy) return
    const c = comment.trim()
    onConfirm(reason === 'Autre' ? c : (c ? `${reason} — ${c}` : reason))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="bg-card rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} style={{ boxShadow: '0 30px 80px rgba(20,30,40,0.2)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold tracking-tight">Refuser {count > 1 ? `${count} demandes` : 'la demande'}</h2>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motif du refus</label>
            <select value={reason} onChange={e => setReason(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground">
              {REFUSAL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {needsComment ? 'Précisez le motif (obligatoire)' : 'Un mot pour le collaborateur (optionnel)'}
            </label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={400}
              placeholder={needsComment ? 'Ex : …' : 'Ex : Peux-tu plutôt proposer la semaine suivante ?'}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground resize-none" />
          </div>
          <p className="text-xs text-muted-foreground">Le motif et le commentaire seront visibles par le collaborateur dans « Mes demandes ».</p>
          <div className="flex gap-2 pt-1">
            <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
            <button onClick={submit} disabled={!valid || busy}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 bg-red-500 hover:bg-red-600 transition-colors">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmer le refus'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
