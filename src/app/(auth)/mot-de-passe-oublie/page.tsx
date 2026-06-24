'use client'

import { useState } from 'react'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/brand/Logo'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
      })
      if (error) {
        setError("Une erreur est survenue. Vérifie l'adresse e-mail.")
      } else {
        setSent(true)
      }
    } catch {
      setError('Erreur réseau. Réessaie dans un instant.')
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

        {sent ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #D1608F, #4891BE)' }}>
              <MailCheck className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-2">E-mail envoyé&nbsp;!</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Si un compte existe pour <span className="font-semibold text-foreground">{email}</span>,
              tu vas recevoir un lien pour réinitialiser ton mot de passe. Pense à vérifier tes spams.
            </p>
            <a href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold accent-text hover:underline">
              <ArrowLeft className="w-4 h-4" /> Retour à la connexion
            </a>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight mb-2">Mot de passe oublié&nbsp;?</h1>
            <p className="text-muted-foreground text-sm mb-7">
              Indique ton adresse e-mail : on t'envoie un lien pour en choisir un nouveau.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-sm font-semibold block mb-1.5">Adresse e-mail</label>
                <input id="email" type="email" required autoComplete="email" autoFocus
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border border-border rounded-xl px-3.5 py-3 text-sm bg-background focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_22%,transparent)] transition"
                  placeholder="vous@aelys.fr"
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading || !email.trim()}
                className="w-full py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                style={{ backgroundImage: 'linear-gradient(135deg, #D1608F, #4891BE)', boxShadow: '0 10px 26px rgba(150,120,170,0.35)' }}
              >
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>

            <div className="text-center mt-6">
              <a href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> Retour à la connexion
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
