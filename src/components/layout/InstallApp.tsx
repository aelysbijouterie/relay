'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/**
 * Enregistre le service worker et propose « Installer l’application » (raccourci bureau, fenêtre sans barre du navigateur).
 * Le bouton disparaît une fois l’application installée / ouverte en mode application.
 */
export function InstallApp({ variant = 'row' }: { variant?: 'row' | 'icon' }) {
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  const [help, setHelp] = useState(false)
  const [standalone, setStandalone] = useState(true)

  useEffect(() => {
    setStandalone(window.matchMedia('(display-mode: standalone)').matches)
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { /* noop */ })
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent) }
    const onInstalled = () => { setEvt(null); setStandalone(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  if (standalone) return variant === 'row' ? <p className="text-sm text-green-600 font-medium">✓ Vous utilisez déjà RELAYS comme application.</p> : null

  async function install() {
    if (!evt) { setHelp(true); return }
    await evt.prompt()
    await evt.userChoice.catch(() => null)
    setEvt(null)
  }

  return (
    <>
      {variant === 'icon' ? (
        <button type="button" onClick={install} aria-label="Installer l’application" title="Installer l’application"
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Download className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button type="button" onClick={install}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition-colors">
          <Download className="w-4 h-4" /> Installer l’application
        </button>
      )}
      {help && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setHelp(false)}>
          <div className="bg-card rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-extrabold tracking-tight">Installer RELAYS sur cet ordinateur</h2>
              <button onClick={() => setHelp(false)} aria-label="Fermer" className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <ol className="text-sm space-y-2 list-decimal pl-5">
              <li><strong>Chrome</strong> : icône « Installer » à droite de la barre d’adresse (petit écran avec une flèche), ou menu ⋮ → « Diffuser, enregistrer et partager » → « Installer RELAYS ». <strong>Edge</strong> : menu … → Applications → « Installer ce site en tant qu’application ».</li>
              <li>Validez : RELAYS s’ouvre dans sa propre fenêtre, sans barre d’adresse, avec un <strong>raccourci sur le bureau</strong> (cochez « Créer un raccourci sur le Bureau » si proposé).</li>
              <li><strong>Ouverture automatique au démarrage de l’ordinateur</strong> : Chrome → tapez <em>chrome://apps</em>, clic droit sur RELAYS → « Démarrer à l’ouverture de session ». Edge → <em>edge://apps</em> → RELAYS → « Démarrer à la connexion ».</li>
            </ol>
            <button onClick={() => setHelp(false)} className="mt-4 w-full py-2 rounded-xl bg-muted text-sm font-medium hover:bg-muted/70">Fermer</button>
          </div>
        </div>
      )}
    </>
  )
}
