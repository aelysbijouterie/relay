'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, Pencil, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface BalanceInfo { start: number | null; taken: number; remaining: number | null }
interface Balances { conges: BalanceInfo; rtt: BalanceInfo; pending?: number; pendingRtt?: number; acquiring?: number; split?: number; is_cadre?: boolean }

export function LeaveBalance({ refreshKey, onlyConges = false }: { refreshKey?: number; onlyConges?: boolean }) {
  const [bal, setBal] = useState<Balances | null>(null)
  const [editing, setEditing] = useState(false)
  const [conges, setConges] = useState('')
  const [rtt, setRtt] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/absences/balance', { cache: 'no-store' })
      const d = await r.json()
      if (d?.conges) {
        setBal(d)
        setConges(d.conges.start != null ? String(d.conges.start) : '')
        setRtt(d.rtt.start != null ? String(d.rtt.start) : '')
      }
    } catch { /* noop */ }
  }, [])
  useEffect(() => { load() }, [load, refreshKey])

  async function save() {
    setSaving(true)
    try {
      const r = await fetch('/api/absences/balance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conges: conges === '' ? null : conges, rtt: rtt === '' ? null : rtt }),
      })
      if (!r.ok) throw new Error()
      toast.success('Soldes enregistrés')
      setEditing(false)
      load()
    } catch { toast.error('Enregistrement impossible') }
    finally { setSaving(false) }
  }

  const fmt = (n: number | null) => n == null ? '—' : (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))

  // Boutique : jours ACQUIS (posables) distingués des jours EN COURS D'ACQUISITION ; solde géré par la RH.
  if (onlyConges) {
    const remaining = bal?.conges.remaining ?? null
    const negative = remaining != null && remaining < 0
    return (
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-bold">Mes compteurs</h2>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl p-3" style={{ backgroundColor: negative ? 'rgba(220,38,38,0.08)' : 'rgba(14,165,165,0.08)' }}>
            <p className="text-xs font-semibold" style={{ color: negative ? '#DC2626' : '#0EA5A5' }}>Jours acquis (à poser)</p>
            <p className="text-2xl font-extrabold mt-0.5" style={negative ? { color: '#DC2626' } : undefined}>
              {fmt(remaining)}<span className="text-sm font-medium text-muted-foreground"> j</span>
            </p>
            {negative && <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>Négatif : jours pris par anticipation</p>}
            {bal && bal.conges.start != null && <p className="text-xs text-muted-foreground">{fmt(bal.conges.taken)} pris dans RELAYS depuis l&apos;import</p>}
            {(bal?.split ?? 0) > 0 && <p className="text-xs text-muted-foreground">dont {fmt(bal!.split!)} j de fractionnement</p>}
            {(bal?.pending ?? 0) > 0 && <p className="text-xs text-muted-foreground">{fmt(bal!.pending!)} j en attente de validation</p>}
          </div>
          {bal?.is_cadre && (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(99,102,241,0.08)' }}>
              <p className="text-xs font-semibold" style={{ color: '#6366F1' }}>RTT (cadre)</p>
              <p className="text-2xl font-extrabold mt-0.5" style={(bal.rtt.remaining ?? 0) < 0 ? { color: '#DC2626' } : undefined}>
                {fmt(bal.rtt.remaining)}<span className="text-sm font-medium text-muted-foreground"> j</span>
              </p>
              {(bal.pendingRtt ?? 0) > 0 && <p className="text-xs text-muted-foreground">{fmt(bal.pendingRtt!)} j en attente de validation</p>}
            </div>
          )}
          <div className="rounded-xl p-3 bg-muted/40">
            <p className="text-xs font-semibold text-muted-foreground">En cours d&apos;acquisition</p>
            <p className="text-2xl font-extrabold mt-0.5">{fmt(bal?.acquiring ?? 0)}<span className="text-sm font-medium text-muted-foreground"> j</span></p>
            <p className="text-xs text-muted-foreground">+2,08 j par mois, ajoutés aux jours acquis au 1er juin</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-bold">Mes compteurs</h2>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Définir mes soldes">
            <Pencil className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex gap-1">
            <button onClick={save} disabled={saving} className="p-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={() => { setEditing(false); load() }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
        {/* Congés */}
        <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(14,165,165,0.08)' }}>
          <p className="text-xs font-semibold" style={{ color: '#0EA5A5' }}>Congés payés</p>
          {editing ? (
            <input type="number" step="0.5" value={conges} onChange={e => setConges(e.target.value)} placeholder="Solde annuel"
              className="w-full mt-1 px-2 py-1 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-muted-foreground" />
          ) : bal ? (
            <>
              <p className="text-2xl font-extrabold mt-0.5">{fmt(bal.conges.remaining)}<span className="text-sm font-medium text-muted-foreground"> j restants</span></p>
              <p className="text-xs text-muted-foreground">{fmt(bal.conges.taken)} pris {bal.conges.start != null && `· ${fmt(bal.conges.start)} au total`}</p>
            </>
          ) : <p className="text-sm text-muted-foreground mt-1">—</p>}
        </div>

        {/* RTT */}
        {!onlyConges && (
        <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(99,102,241,0.08)' }}>
          <p className="text-xs font-semibold" style={{ color: '#6366F1' }}>RTT</p>
          {editing ? (
            <input type="number" step="0.5" value={rtt} onChange={e => setRtt(e.target.value)} placeholder="Solde annuel"
              className="w-full mt-1 px-2 py-1 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-muted-foreground" />
          ) : bal ? (
            <>
              <p className="text-2xl font-extrabold mt-0.5">{fmt(bal.rtt.remaining)}<span className="text-sm font-medium text-muted-foreground"> j restants</span></p>
              <p className="text-xs text-muted-foreground">{fmt(bal.rtt.taken)} pris {bal.rtt.start != null && `· ${fmt(bal.rtt.start)} au total`}</p>
            </>
          ) : <p className="text-sm text-muted-foreground mt-1">—</p>}
        </div>
        )}
      </div>
      {editing && <p className="text-xs text-muted-foreground mt-3">Indiquez votre solde annuel. Le décompte se fait automatiquement en jours ouvrés à chaque congé validé.</p>}
    </div>
  )
}
