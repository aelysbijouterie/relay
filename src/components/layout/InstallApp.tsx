'use client'

import { useEffect, useState } from 'react'
import { Download, X, MonitorSmartphone, Rocket } from 'lucide-react'

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/**
 * « Installer l’application » : RELAYS dans sa propre fenêtre (sans barre du navigateur).
 * Un site web n’a pas le droit de créer lui-même un raccourci ni un démarrage automatique : on propose donc
 *  1) l’installation du navigateur (fenêtre dédiée), 2) un petit fichier qui crée le raccourci Bureau + le démarrage automatique.
 */
export function InstallApp({ variant = 'row' }: { variant?: 'row' | 'icon' }) {
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  const [open, setOpen] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [isWindows, setIsWindows] = useState(true)
  const [downloaded, setDownloaded] = useState(false)

  useEffect(() => {
    setStandalone(window.matchMedia('(display-mode: standalone)').matches)
    setIsWindows(/Windows/i.test(navigator.userAgent))
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { /* noop */ })
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent) }
    const onInstalled = () => { setEvt(null); setStandalone(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  async function installBrowser() {
    if (!evt) return
    await evt.prompt()
    await evt.userChoice.catch(() => null)
    setEvt(null)
  }

  const trigger = variant === 'icon' ? (
    <button type="button" onClick={() => setOpen(true)} aria-label="Installer l’application" title="Installer l’application"
      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
      <Download className="w-3.5 h-3.5" />
    </button>
  ) : (
    <div className="space-y-2">
      {standalone && <p className="text-sm text-green-600 font-medium">✓ Vous utilisez déjà RELAYS comme application.</p>}
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition-colors">
        <Download className="w-4 h-4" /> {standalone ? 'Raccourci bureau et démarrage automatique' : 'Installer l’application'}
      </button>
    </div>
  )

  return (
    <>
      {trigger}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-card rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-extrabold tracking-tight">Installer RELAYS sur cet ordinateur</h2>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">RELAYS s’ouvre dans sa propre fenêtre, sans barre du navigateur.</p>

            {isWindows && (
              <div className="rounded-xl border border-border p-4 mb-3">
                <p className="text-sm font-semibold flex items-center gap-2 mb-1"><Rocket className="w-4 h-4" /> Raccourci Bureau + démarrage automatique</p>
                <p className="text-xs text-muted-foreground mb-3">Le plus simple sous Windows : un clic, puis ouvrez le fichier téléchargé. Il crée le raccourci RELAYS sur le Bureau et lance RELAYS à chaque démarrage de l’ordinateur.</p>
                <a href="/RELAYS-raccourci.bat" download="RELAYS-raccourci.bat" onClick={() => setDownloaded(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: 'var(--accent)' }}>
                  <Download className="w-4 h-4" /> Télécharger l’installateur
                </a>
                {downloaded && (
                  <p className="text-xs mt-3 text-foreground">
                    ✓ Téléchargé. <strong>Ouvrez-le</strong> (en bas du navigateur ou dans « Téléchargements »). Si Windows affiche un avertissement, cliquez sur « Informations complémentaires » puis « Exécuter quand même » : le fichier ne fait que créer deux raccourcis.
                  </p>
                )}
              </div>
            )}

            <div className="rounded-xl border border-border p-4">
              <p className="text-sm font-semibold flex items-center gap-2 mb-1"><MonitorSmartphone className="w-4 h-4" /> Installation par le navigateur {isWindows ? '(alternative)' : ''}</p>
              {evt ? (
                <button type="button" onClick={installBrowser} className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted">
                  <Download className="w-4 h-4" /> Installer maintenant
                </button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Chrome : icône « Installer » à droite de la barre d’adresse, ou menu ⋮ → « Diffuser, enregistrer et partager » → « Installer RELAYS ». Edge : menu … → Applications → « Installer ce site en tant qu’application ».
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">Pour l’ouverture automatique de cette version : Chrome, adresse <em>chrome://apps</em>, clic droit sur RELAYS → « Démarrer à l’ouverture de session » (Edge : <em>edge://apps</em>).</p>
            </div>

            <button onClick={() => setOpen(false)} className="mt-4 w-full py-2 rounded-xl bg-muted text-sm font-medium hover:bg-muted/70">Fermer</button>
          </div>
        </div>
      )}
    </>
  )
}
