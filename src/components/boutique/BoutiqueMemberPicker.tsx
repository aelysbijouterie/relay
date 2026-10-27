'use client'

import { useEffect, useState } from 'react'
import { UserRound, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Member { id: string; name: string }
interface MembersResponse { isBoutique: boolean; members?: Member[]; current?: string | null }

/**
 * Sélecteur du collaborateur actif d'une boutique. Le compte est partagé par
 * la boutique ; ce choix détermine au nom de qui sont posés les congés.
 */
export function BoutiqueMemberPicker() {
  const [members, setMembers] = useState<Member[]>([])
  const [current, setCurrent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const r = await fetch('/api/boutique/members', { cache: 'no-store' })
      const d: MembersResponse = await r.json()
      setMembers(d.members ?? [])
      setCurrent(d.current ?? '')
    } catch { /* noop */ }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function choose(id: string) {
    setBusy(true)
    try {
      const r = await fetch('/api/boutique/members', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: id || null }),
      })
      if (!r.ok) throw new Error()
      // Rechargement complet : toutes les vues (Congés…) repartent sur le bon collaborateur.
      window.location.reload()
    } catch { toast.error('Sélection impossible'); setBusy(false) }
  }

  async function add() {
    if (newName.trim().length < 2) return
    setBusy(true)
    try {
      const r = await fetch('/api/boutique/members', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Ajout impossible')
      await choose(d.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ajout impossible')
      setBusy(false)
    }
  }

  return (
    <div className="px-4 py-3 border-t border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Collaborateur</p>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="relative">
            <UserRound className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={current}
              disabled={busy}
              onChange={e => choose(e.target.value)}
              className="w-full pl-8 pr-2 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground"
            >
              <option value="">— Qui êtes-vous ? —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {adding ? (
            <div className="mt-2 flex gap-1.5">
              <input
                autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') add() }}
                placeholder="Prénom Nom"
                className="min-w-0 flex-1 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground"
              />
              <button onClick={add} disabled={busy || newName.trim().length < 2}
                className="px-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}>OK</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="w-3.5 h-3.5" /> Ajouter un collaborateur
            </button>
          )}
          {!current && members.length > 0 && (
            <p className="mt-2 text-[0.7rem] text-amber-600">Choisissez votre nom pour poser des congés.</p>
          )}
        </>
      )}
    </div>
  )
}
