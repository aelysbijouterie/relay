'use client'

// Injecte les variables d'accent (--accent, --accent-deep, --accent-soft)
// au niveau du conteneur dashboard, à partir de la couleur de l'espace actif.
// Tout l'UI (boutons, barres, focus…) lit ces variables : changer d'espace
// reteinte automatiquement les accents, la sidebar restant neutre.

import { useMemo } from 'react'

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

// Assombrit une couleur d'un facteur (0–1) pour --accent-deep.
function darken(hex: string, factor = 0.82): string {
  const [r, g, b] = hexToRgb(hex)
  const d = (n: number) => Math.round(n * factor)
  return `#${[d(r), d(g), d(b)].map(n => n.toString(16).padStart(2, '0')).join('')}`
}

export function AccentProvider({ color, children }: { color: string; children: React.ReactNode }) {
  const style = useMemo(() => {
    const safe = /^#[0-9a-fA-F]{3,6}$/.test(color) ? color : '#E0596A'
    const [r, g, b] = hexToRgb(safe)
    return {
      '--accent':        safe,
      '--accent-deep':   darken(safe),
      '--accent-soft':   `rgba(${r}, ${g}, ${b}, 0.12)`,
      '--accent-contrast': '#ffffff',
    } as React.CSSProperties
  }, [color])

  return <div style={style} className="contents">{children}</div>
}