'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, Pencil, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface BalanceInfo { start: number | null; taken: number; remaining: number | null }
interface Balances { conges: BalanceInfo; rtt: BalanceInfo }

export function LeaveBalance({ refreshKey }: { refreshKey?: number }) {
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
        <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(42,157,143,0.08)' }}>
          <p className="text-xs font-semibold" style={{ color: '#2A9D8F' }}>Congés payés</p>
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
        <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(62,143,204,0.08)' }}>
          <p className="text-xs font-semibold" style={{ color: '#3E8FCC' }}>RTT</p>
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
      </div>
      {editing && <p className="text-xs text-muted-foreground mt-3">Indiquez votre solde annuel. Le décompte se fait automatiquement en jours ouvrés à chaque congé validé.</p>}
    </div>
  )
}
