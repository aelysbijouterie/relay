'use client'

import { useState } from 'react'
import { UserPlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Shop { id: string; code: number; name: string }
export interface RhMember {
  id: string; name: string; boutique_id: string; contract_type: string | null
  hire_date: string | null; is_cadre: boolean
}

const CONTRACTS = ['CDI', 'CDD', 'Apprentissage', 'CDD+6', 'Apprentissage+1']

/** Nouveaux entrants (création + attribution à un magasin + date d'entrée) et fiches des collaborateurs. */
export function RhMembers({ boutiques, members, absenceCounts, onChanged }: { boutiques: Shop[]; members: RhMember[]; absenceCounts: Record<string, number>; onChanged: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', boutique_id: '', contract_type: 'CDI', hire_date: '', is_cadre: false })
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')

  async function create() {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.boutique_id || !form.hire_date) { toast.error('Prénom, nom, magasin et date d\'entrée requis'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/rh/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Création impossible')
      toast.success(`${d.name} ajouté(e) à ${d.boutique} (${String(d.acquiring).replace('.', ',')} j déjà en acquisition)`)
      setForm(f => ({ ...f, first_name: '', last_name: '', hire_date: '', is_cadre: false }))
      onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Création impossible') }
    finally { setSaving(false) }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const r = await fetch('/api/rh/members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) })
    if (!r.ok) { const d = await r.json().catch(() => ({})); toast.error(d.error ?? 'Modification impossible'); return }
    toast.success('Enregistré')
    onChanged()
  }

  async function remove(m: RhMember) {
    const n = absenceCounts[m.id] ?? 0
    const shop = boutiques.find(b => b.id === m.boutique_id)
    const lines = [
      `Supprimer ${m.name}${shop ? ` (${shop.name})` : ''} ?`,
      '',
      n > 0
        ? `Ses ${n} demande${n > 1 ? 's' : ''} de congés (validées, en attente ou refusées) seront aussi supprimée${n > 1 ? 's' : ''}.`
        : "Aucune demande de congés n'est liée à ce collaborateur.",
      'Cette action est définitive.',
    ]
    const msg = lines.join('\n')
    if (!confirm(msg)) return
    const r = await fetch(`/api/rh/members?id=${m.id}`, { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { toast.error(d.error ?? 'Suppression impossible'); return }
    toast.success(`${m.name} supprimé(e)`)
    onChanged()
  }

  const shopName = (id: string) => boutiques.find(b => b.id === id)
  const shown = members
    .filter(m => !filter || m.boutique_id === filter)
    .sort((a, b) => (shopName(a.boutique_id)?.code ?? 0) - (shopName(b.boutique_id)?.code ?? 0) || a.name.localeCompare(b.name))

  const input = 'w-full mt-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-muted-foreground'
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-4">
        <h2 className="text-sm font-bold mb-1 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Nouvel entrant</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Le collaborateur est rattaché au magasin choisi. Ses jours de congés en cours d&apos;acquisition sont calculés automatiquement
          depuis la date d&apos;entrée (2,08 j par mois, mois d&apos;entrée compté), puis augmentent chaque 1er du mois.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><label className="text-xs font-semibold text-muted-foreground">Prénom</label>
            <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className={input} /></div>
          <div><label className="text-xs font-semibold text-muted-foreground">Nom</label>
            <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className={input} /></div>
          <div><label className="text-xs font-semibold text-muted-foreground">Magasin</label>
            <select value={form.boutique_id} onChange={e => setForm(f => ({ ...f, boutique_id: e.target.value }))} className={input}>
              <option value="">Choisir…</option>
              {boutiques.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
            </select></div>
          <div><label className="text-xs font-semibold text-muted-foreground">Contrat</label>
            <select value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))} className={input}>
              {CONTRACTS.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><label className="text-xs font-semibold text-muted-foreground">Date d&apos;entrée</label>
            <input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} className={input} /></div>
          <label className="flex items-center gap-2 mt-6 cursor-pointer text-sm">
            <input type="checkbox" checked={form.is_cadre} onChange={e => setForm(f => ({ ...f, is_cadre: e.target.checked }))} className="w-4 h-4 rounded" />
            Cadre (accès aux RTT)
          </label>
        </div>
        <button onClick={create} disabled={saving}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Créer le collaborateur
        </button>
      </div>

      <div className="space-y-3">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm max-w-[16rem]">
          <option value="">Tous les magasins</option>
          {boutiques.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
        </select>
        <div className="bg-card border border-border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="p-3">Collaborateur</th><th className="p-3">Magasin</th><th className="p-3">Contrat</th><th className="p-3">Date d&apos;entrée</th><th className="p-3 text-center">Cadre</th><th className="p-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {shown.map(m => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium whitespace-nowrap">{m.name}</td>
                  <td className="p-3">
                    <select value={m.boutique_id} onChange={e => patch(m.id, { boutique_id: e.target.value })}
                      className="px-2 py-1 rounded-lg bg-background border border-border text-sm max-w-[14rem]">
                      {boutiques.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{m.contract_type ?? '—'}</td>
                  <td className="p-3">
                    <input type="date" defaultValue={m.hire_date ?? ''} key={`${m.id}-${m.hire_date ?? ''}`}
                      onBlur={e => { if ((e.target.value || null) !== m.hire_date) patch(m.id, { hire_date: e.target.value || null }) }}
                      className="px-2 py-1 rounded-lg bg-background border border-border text-sm" />
                  </td>
                  <td className="p-3 text-center">
                    <input type="checkbox" checked={m.is_cadre} onChange={e => patch(m.id, { is_cadre: e.target.checked })} className="w-4 h-4 rounded" />
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => remove(m)} title={`Supprimer ${m.name}`}
                      className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun collaborateur.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
