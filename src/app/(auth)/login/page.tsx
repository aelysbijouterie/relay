'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

export default function LoginPage() {
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showPwd, setShowPwd]   = useState(false)

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Identifiants incorrects')
      } else {
        window.location.replace('/kanban')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-5xl bg-card rounded-3xl overflow-hidden flex"
           style={{ boxShadow: '0 30px 80px rgba(20,30,40,0.14)' }}>

        {/* ── Colonne formulaire ── */}
        <div className="flex-1 p-10 sm:p-12 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-8">
            <Logo size={34} />
            <span className="text-xl font-extrabold tracking-tight">relays</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Bon retour&nbsp;👋</h1>
          <p className="text-muted-foreground text-sm mb-7">Connecte-toi pour retrouver tes tâches du jour.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-semibold block mb-1.5">Adresse e-mail</label>
              <input id="email" name="email" type="email" required autoComplete="email"
                className="w-full border border-border rounded-xl px-3.5 py-3 text-sm bg-background focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_22%,transparent)] transition"
                placeholder="vous@Aélys.fr"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-sm font-semibold">Mot de passe</label>
                <a href="/mot-de-passe-oublie" className="text-xs font-semibold accent-text hover:underline">
                  Mot de passe oublié&nbsp;?
                </a>
              </div>
              <div className="relative">
                <input id="password" name="password" type={showPwd ? 'text' : 'password'} required autoComplete="current-password"
                  className="w-full border border-border rounded-xl px-3.5 py-3 pr-11 text-sm bg-background focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_22%,transparent)] transition"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-transform hover:scale-[1.01] active:scale-[0.99]"
              style={{ backgroundImage: 'linear-gradient(135deg, #D1608F, #4891BE)', boxShadow: '0 10px 26px rgba(150,120,170,0.35)' }}
            >
              {loading ? 'Connexion…' : 'Se connecter →'}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-7">Accès réservé aux collaborateurs Aélys</p>
        </div>

        {/* ── Colonne marque (dégradé rose → bleu) ── */}
        <div className="hidden md:flex w-[360px] flex-col justify-end p-10 relative overflow-hidden"
             style={{ backgroundImage: 'linear-gradient(155deg, #D1608F, #4891BE)' }}>
          <div className="absolute rounded-full" style={{ width: 210, height: 210, top: -70, right: -60, background: 'rgba(255,255,255,0.12)' }} />
          <div className="absolute rounded-full" style={{ width: 130, height: 130, top: 140, left: -50, background: 'rgba(255,255,255,0.09)' }} />

          <div className="absolute bg-white rounded-2xl px-3.5 py-3 flex items-center gap-2.5"
               style={{ top: 46, left: 28, boxShadow: '0 14px 34px rgba(40,20,50,0.2)' }}>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ background: '#FBEAF2' }}>🔔</span>
            <div>
              <div className="text-[12.5px] font-bold text-gray-900 leading-tight">Nouvelle assignation</div>
              <div className="text-[11px] text-gray-500 font-semibold">Réception commande fournisseur</div>
            </div>
          </div>
          <div className="absolute bg-white rounded-2xl px-3.5 py-3 flex items-center gap-2.5"
               style={{ top: 142, right: 24, boxShadow: '0 14px 34px rgba(40,20,50,0.2)' }}>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ background: '#E8F2FB' }}>✅</span>
            <div>
              <div className="text-[12.5px] font-bold text-gray-900 leading-tight">Tâche terminée</div>
              <div className="text-[11px] text-gray-500 font-semibold">Contrat signé</div>
            </div>
          </div>

          <div className="relative z-10">
            <div className="text-white text-xl font-bold leading-snug tracking-tight">
              Toute l'équipe Aélys, alignée sur les mêmes priorités.
            </div>
            <div className="text-white/80 text-xs mt-3 font-semibold">Gestion de tâches · Bijouterie Aélys</div>
          </div>
        </div>

      </div>
    </div>
  )
}