'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const DEMO_DEPTS = [
  { slug: 'marketing',     name: 'Marketing',     color: '#ECEFBD' },
  { slug: 'web',           name: 'Web',           color: '#EB5C82' },
  { slug: 'administratif', name: 'Administratif', color: '#54673C' },
  { slug: 'rh',            name: 'RH',            color: '#C9E1F8' },
  { slug: 'logistique',    name: 'Logistique',    color: '#FAFFAD' },
  { slug: 'direction',     name: 'Direction',     color: '#0A2342' },
]

export default function LoginPage() {
  const [loading, setLoading]       = useState(false)
  const [demoLoading, setDemoLoading] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setLoading(true)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:    fd.get('email'),
          password: fd.get('password'),
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Identifiants incorrects')
        return
      }

      window.location.href = '/kanban'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.error('Délai dépassé — vérifie ta connexion')
      } else {
        toast.error('Erreur réseau')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleDemo(slug: string) {
    setDemoLoading(slug)
    try {
      await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      router.push('/kanban')
      router.refresh()
    } catch {
      toast.error('Erreur')
      setDemoLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="text-center">
          <h1 className="font-heading text-5xl font-bold tracking-tight">RELAYS</h1>
          <p className="text-muted-foreground mt-2 text-sm">Gestion de tâches · Aelys</p>
        </div>

        {/* Carte */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-6">

          {/* Accès démo par service */}
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
                  style={demoLoading === dept.slug ? {
                    backgroundColor: dept.color,
                    borderColor: dept.color,
                    color: 'white',
                  } : {
                    borderColor: `${dept.color}66`,
                    color: dept.color,
                  }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dept.color }} />
                  {demoLoading === dept.slug ? 'Chargement…' : dept.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">ou connexion avec compte</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium block mb-1.5">
                Adresse email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                placeholder="vous@aelys.fr"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium block mb-1.5">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !!demoLoading}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Accès réservé aux collaborateurs Aelys
        </p>
      </div>
    </div>
  )
}
