'use client'

import { useState } from 'react'
import { Sparkles, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  title: string
  description: string
  /** Appelé quand la personne valide la proposition (rien n'est jamais remplacé sans validation). */
  onApply: (v: { title: string; description: string }) => void | Promise<void>
  /** `compact` : icône seule sur petit écran (barre d'actions de la carte). */
  compact?: boolean
}

/**
 * « Reformuler avec l'IA » : met au propre le titre et les notes d'une carte.
 * Même dégradé que « Générer mon Focus ». Affiche un AVANT / APRÈS ; la personne choisit d'appliquer ou de garder ses notes.
 */
export function AIImproveButton({ title, description, onApply, compact = false }: Props) {
  const [loading, setLoading] = useState(false)
  const [proposal, setProposal] = useState<{ title: string; description: string } | null>(null)
  const [applying, setApplying] = useState(false)

  async function run() {
    if (title.trim().length < 3 && description.trim().length < 3) { toast.error('Écrivez d’abord vos notes'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/ai/improve-task', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'Erreur')
      setProposal({ title: j.title ?? title, description: j.description ?? description })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'L’IA ne répond pas')
    } finally { setLoading(false) }
  }

  async function apply() {
    if (!proposal) return
    setApplying(true)
    try { await onApply(proposal); setProposal(null); toast.success('Texte mis au propre') }
    finally { setApplying(false) }
  }

  return (
    <>
      <button type="button" onClick={run} disabled={loading}
        title="Reformuler le titre et les notes avec l’IA (vous validez avant)"
        className="group inline-flex items-center gap-1.5 rounded-xl text-white text-xs font-bold px-3 py-1.5 transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:opacity-70 whitespace-nowrap"
        style={{ backgroundImage: 'linear-gradient(135deg, #D1608F, #7E6FB0 55%, #4891BE)', boxShadow: '0 6px 16px rgba(150,120,170,0.35)' }}>
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        <span className={compact ? 'hidden sm:inline' : undefined}>{loading ? 'Reformulation…' : 'Reformuler avec l’IA'}</span>
      </button>

      {proposal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => !applying && setProposal(null)}>
          <div className="bg-card rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2"><Sparkles className="w-4 h-4" /> Proposition de l’IA</h2>
              <button type="button" onClick={() => setProposal(null)} aria-label="Fermer" className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Relisez : rien n’est modifié tant que vous n’avez pas cliqué sur « Utiliser cette version ».</p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Vos notes</p>
                <p className="text-sm font-semibold mb-2 whitespace-pre-wrap">{title || '—'}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{description || '—'}</p>
              </div>
              <div className="rounded-xl border-2 p-3" style={{ borderColor: '#7E6FB0' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7E6FB0' }}>Version mise au propre</p>
                <p className="text-sm font-semibold mb-2 whitespace-pre-wrap">{proposal.title || '—'}</p>
                <p className="text-sm whitespace-pre-wrap">{proposal.description || '—'}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end mt-5">
              <button type="button" onClick={() => setProposal(null)} disabled={applying} className="px-4 py-2 rounded-xl text-sm border border-border hover:bg-muted disabled:opacity-50">Garder mes notes</button>
              <button type="button" onClick={run} disabled={applying || loading} className="px-4 py-2 rounded-xl text-sm border border-border hover:bg-muted disabled:opacity-50">
                {loading ? 'Nouvelle version…' : 'Autre version'}
              </button>
              <button type="button" onClick={apply} disabled={applying}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundImage: 'linear-gradient(135deg, #D1608F, #7E6FB0 55%, #4891BE)' }}>
                {applying ? 'Application…' : 'Utiliser cette version'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
