'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { demoAction } from './actions'

const DEMO_DEPTS = [
  { slug: 'marketing',     name: 'Marketing',     color: '#7A7E2A' },
  { slug: 'web',           name: 'Web',           color: '#EB5C82' },
  { slug: 'administratif', name: 'Administratif', color: '#54673C' },
  { slug: 'rh',            name: 'RH',            color: '#3A7CB8' },
  { slug: 'logistique',    name: 'Logistique',    color: '#7A7E2A' },
  { slug: 'direction',     name: 'Direction',     color: '#0A2342' },
]

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [demoLoading, setDemoLoading] = useState<string | null>(null)

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = getSupabase()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })
      if (error) {
        setError('Email non reconnu ou erreur d\'envoi')
      } else {
        setStep('code')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = getSupabase()
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      })
      if (error) {
        setError('Code incorrect ou expiré')
      } else {
        window.location.replace('/kanban')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  async function handleDemo(slug: string) {
    setDemoLoading(slug)
    try {
      const fd = new FormData()
      fd.append('slug', slug)
      await demoAction(fd)
    } catch {}
    window.location.replace('/kanban')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">

        <div className="text-center">
          <h1 className="font-heading text-5xl font-bold tracking-tight">RELAYS</h1>
          <p className="text-muted-foreground mt-2 text-sm">Gestion de tâches · Aelys</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-6">

          {/* Accès démo */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Accès démo par service
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_DEPTS.map(dept => (
                <button
                  key={dept.slug}
                  type="button"
                  onClick={() => handleDemo(dept.slug)}
                  disabled={!!demoLoading}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all disabled:opacity-60 hover:scale-[1.02] active:scale-[0.98]"
                  style={demoLoading === dept.slug
                    ? { backgroundColor: dept.color, borderColor: dept.color, color: 'white' }
                    : { borderColor: `${dept.color}66`, color: dept.color }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dept.color }} />
                  {demoLoading === dept.slug ? 'Chargement…' : dept.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">ou connexion sécurisée</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Étape 1 — Email */}
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-sm font-medium block mb-1.5">
                  Adresse email
                </label>
                <input
                  id="email" type="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="vous@aelys.fr"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Envoi…' : 'Recevoir mon code'}
              </button>
            </form>
          )}

          {/* Étape 2 — Code */}
          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Code envoyé à</p>
                <p className="text-sm text-primary font-semibold">{email}</p>
                <p className="text-xs text-muted-foreground">Vérifie tes spams si tu ne le vois pas</p>
              </div>
              <div>
                <label htmlFor="code" className="text-sm font-medium block mb-1.5">
                  Code de connexion
                </label>
                <input
                  id="code" type="text" inputMode="numeric" pattern="\d*"
                  maxLength={6} required
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow text-center text-2xl tracking-[0.5em] font-mono"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit" disabled={loading || code.length < 6}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Vérification…' : 'Se connecter'}
              </button>
              <button
                type="button" onClick={() => { setStep('email'); setCode(''); setError('') }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Utiliser une autre adresse
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Accès réservé aux collaborateurs Aelys
        </p>
      </div>
    </div>
  )
}
