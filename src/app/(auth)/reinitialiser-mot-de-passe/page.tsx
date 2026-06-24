'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/brand/Logo'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady]       = useState(false)   // session de récupération active ?
  const [pwd, setPwd]           = useState('')
  const [pwd2, setPwd2]         = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState('')

  // À l'arrivée depuis l'e-mail, Supabase crée une session de récupération.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (pwd.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return }
    if (pwd !== pwd2)   { setError('Les deux mots de passe ne correspondent pas.'); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: pwd })
      if (error) {
        setError("Le lien a peut-être expiré. Redemande un e-mail de réinitialisation.")
      } else {
        setDone(true)
        setTimeout(() => router.push('/login'), 2500)
      }
    } catch {
      setError('Erreur réseau. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card rounded-3xl p-8 sm:p-10"
           style={{ boxShadow: '0 30px 80px rgba(20,30,40,0.14)' }}>
        <div className="flex items-center gap-3 mb-8">
          <Logo size={32} />
          <span className="text-xl font-extrabold tracking-tight">relays</span>
        </div>

        {done ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #1F9D57, #2A9D8F)' }}>
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-2">Mot de passe modifié&nbsp;!</h1>
            <p className="text-muted-foreground text-sm">Tu vas être redirigé vers la connexion…</p>
          </div>
        ) : !ready ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">Vérification du lien…</p>
            <p className="text-xs text-muted-foreground mt-4">
              Si rien ne se passe, le lien a peut-être expiré.{' '}
              <a href="/mot-de-passe-oublie" className="accent-text font-semibold hover:underline">Redemander un e-mail</a>.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight mb-2">Nouveau mot de passe</h1>
            <p className="text-muted-foreground text-sm mb-7">Choisis un mot de passe d'au moins 8 caractères.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-semibold block mb-1.5">Nouveau mot de passe</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} required autoFocus
                    value={pwd} onChange={e => setPwd(e.target.value)}
                    className="w-full border border-border rounded-xl px-3.5 py-3 pr-11 text-sm bg-background focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_22%,transparent)] transition"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1.5">Confirme le mot de passe</label>
                <input type={showPwd ? 'text' : 'password'} required
                  value={pwd2} onChange={e => setPwd2(e.target.value)}
                  className="w-full border border-border rounded-xl px-3.5 py-3 text-sm bg-background focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_22%,transparent)] transition"
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading || !pwd || !pwd2}
                className="w-full py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                style={{ backgroundImage: 'linear-gradient(135deg, #D1608F, #4891BE)', boxShadow: '0 10px 26px rgba(150,120,170,0.35)' }}
              >
                {loading ? 'Enregistrement…' : 'Définir le mot de passe'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
