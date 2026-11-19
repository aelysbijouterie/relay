'use client'

import { useCallback, useEffect, useState } from 'react'
import { Mail, Loader2, Check, X, RefreshCw, PlugZap } from 'lucide-react'
import { toast } from 'sonner'

interface Item {
  id: string; status: 'pending' | 'created'; from_name: string | null; from_email: string | null; subject: string | null
  received_at: string | null; title: string | null; description: string | null; priority: string | null; deadline: string | null
}
interface Data { configured: { mail: boolean; ai: boolean }; auto: boolean; items: Item[] }

const PRIORITIES = ['Urgent', 'Élevée', 'Moyenne', 'Faible']

export function MailSuggestionsView() {
  const [data, setData] = useState<Data | null>(null)
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Partial<Item>>>({})

  const load = useCallback(async () => {
    const r = await fetch('/api/mail-suggestions', { cache: 'no-store' })
    if (r.status === 403) { setDenied(true); return }
    setData(await r.json())
  }, [])
  useEffect(() => { load() }, [load])

  const val = (it: Item, k: keyof Item) => (edits[it.id]?.[k] ?? it[k] ?? '') as string
  const edit = (id: string, patch: Partial<Item>) => setEdits(e => ({ ...e, [id]: { ...e[id], ...patch } }))

  async function act(it: Item, action: 'create' | 'dismiss') {
    setBusy(it.id)
    const r = await fetch(`/api/mail-suggestions/${it.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, title: val(it, 'title'), description: val(it, 'description'), priority: val(it, 'priority'), deadline: val(it, 'deadline') }),
    })
    setBusy(null)
    if (r.ok) { toast.success(action === 'create' ? 'Carte créée' : 'Proposition ignorée'); load() }
    else toast.error((await r.json().catch(() => ({}))).error ?? 'Erreur')
  }

  async function run(action: 'test' | 'scan') {
    setBusy(action)
    const r = await fetch('/api/mail-suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    const j = await r.json().catch(() => ({}))
    setBusy(null)
    if (action === 'test') {
      if (j.ok) toast.success(`Connexion OK — ${j.count} mail(s) reçu(s) ces 3 derniers jours`)
      else toast.error(j.error ?? 'Connexion impossible')
    } else if (j.ok) {
      toast.success(`${j.read} mail(s) lus · ${j.proposed + j.created} action(s) trouvée(s)${j.retryLater ? ` · ${j.retryLater} à retenter` : ''}`)
      load()
    } else toast.error(j.error ?? 'Analyse impossible')
  }

  if (denied) return <div className="p-8 text-sm text-muted-foreground">Cette page est réservée à la personne dont la boîte mail est analysée.</div>
  if (!data) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>

  const pending = data.items.filter(i => i.status === 'pending')
  const created = data.items.filter(i => i.status === 'created')

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold mb-1 flex items-center gap-2"><Mail className="w-5 h-5" /> Mails à traiter</h2>
          <p className="text-sm text-muted-foreground">
            Chaque jour à 8 h, RELAYS lit vos mails et propose les actions à mener.{' '}
            {data.auto ? 'Les cartes sont créées automatiquement.' : 'Vous validez celles qui deviennent des cartes.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => run('test')} disabled={!!busy} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-border hover:bg-muted disabled:opacity-50">
            {busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />} Tester la connexion
          </button>
          <button onClick={() => run('scan')} disabled={!!busy || !data.configured.mail || !data.configured.ai}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
            {busy === 'scan' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Analyser maintenant
          </button>
        </div>
      </div>

      {(!data.configured.mail || !data.configured.ai) && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold mb-1">Configuration incomplète dans Vercel</p>
          <ul className="list-disc pl-5">
            {!data.configured.mail && <li>Connexion à la boîte : <code>MAIL_IMAP_HOST</code>, <code>MAIL_IMAP_USER</code> et <code>MAIL_IMAP_PASSWORD</code> manquent.</li>}
            {!data.configured.ai && <li>Clé de l’IA : <code>GEMINI_API_KEY</code> manque.</li>}
          </ul>
        </div>
      )}

      {pending.length === 0 && data.configured.mail && (
        <p className="text-sm text-muted-foreground text-center py-10">Aucune action en attente. Rien à valider pour l’instant.</p>
      )}

      <div className="space-y-3">
        {pending.map(it => (
          <div key={it.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{it.from_name || it.from_email}</span> — {it.subject}
              {it.received_at && <> · {new Date(it.received_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</>}
            </div>
            <input value={val(it, 'title')} onChange={e => edit(it.id, { title: e.target.value })} aria-label="Titre de la carte"
              className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm font-semibold" />
            <textarea value={val(it, 'description')} onChange={e => edit(it.id, { description: e.target.value })} rows={3} aria-label="Description"
              className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm" />
            <div className="flex flex-wrap items-center gap-2">
              <select value={val(it, 'priority') || 'Moyenne'} onChange={e => edit(it.id, { priority: e.target.value })} aria-label="Priorité"
                className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm">
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
              <input type="date" value={val(it, 'deadline')} onChange={e => edit(it.id, { deadline: e.target.value })} aria-label="Échéance"
                className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm" />
              <div className="flex gap-2 ml-auto">
                <button onClick={() => act(it, 'dismiss')} disabled={busy === it.id} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-border hover:bg-muted disabled:opacity-50">
                  <X className="w-4 h-4" /> Ignorer
                </button>
                <button onClick={() => act(it, 'create')} disabled={busy === it.id} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
                  {busy === it.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Créer la carte
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {created.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cartes déjà créées à partir de vos mails</h3>
          <div className="space-y-1">
            {created.slice(0, 20).map(it => (
              <p key={it.id} className="text-sm flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" /><span className="truncate">{it.title}</span>
                <span className="text-xs text-muted-foreground truncate">— {it.from_name || it.from_email}</span></p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
