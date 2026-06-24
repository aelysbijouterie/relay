// Pictogramme RELAYS : trois cartes translucides en profondeur.
// La carte avant (rose) est pleine ; plus on remonte vers l'arrière,
// plus les cartes deviennent transparentes (bleu). Les recouvrements
// créent des teintes intermédiaires — l'effet « relais » + la profondeur.

interface LogoProps {
  size?: number
  withWordmark?: boolean
  className?: string
}

export function Logo({ size = 28, withWordmark = false, className }: LogoProps) {
  const height = size

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg
        width={height}
        height={height}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Relays"
      >
        {/* carte arrière (bleu) — la plus transparente */}
        <rect x="21" y="3"  width="16" height="16" rx="4.5" fill="#4891BE" opacity="0.45" />
        {/* carte milieu — teinte intermédiaire */}
        <rect x="12" y="12" width="16" height="16" rx="4.5" fill="#7E6FB0" opacity="0.7" />
        {/* carte avant (rose) — pleine */}
        <rect x="3"  y="21" width="16" height="16" rx="4.5" fill="#D1608F" opacity="0.95" />
      </svg>
      {withWordmark && (
        <span style={{ fontWeight: 700, fontSize: size * 0.62, letterSpacing: '-0.02em', lineHeight: 1 }}>
          relays
        </span>
      )}
    </span>
  )
}