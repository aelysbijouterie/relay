// Pictogramme RELAYS : deux cercles qui se chevauchent (la "zone de passage").
// Le cercle rose et le cercle bleu se superposent avec un fondu (multiply),
// symbolisant le relais entre deux équipes.

interface LogoProps {
  size?: number
  withWordmark?: boolean
  className?: string
}

export function Logo({ size = 28, withWordmark = false, className }: LogoProps) {
  const height = size
  const width = withWordmark ? undefined : Math.round(size * 1.6)

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg
        width={Math.round(height * 1.6)}
        height={height}
        viewBox="0 0 64 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Relays"
      >
        <circle cx="24" cy="20" r="15" fill="#D1608F" />
        <circle cx="40" cy="20" r="15" fill="#4891BE" style={{ mixBlendMode: 'multiply' }} />
      </svg>
      {withWordmark && (
        <span style={{ fontWeight: 700, fontSize: size * 0.62, letterSpacing: '-0.02em', lineHeight: 1 }}>
          relays
        </span>
      )}
    </span>
  )
}