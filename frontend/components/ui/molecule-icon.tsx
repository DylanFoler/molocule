import type { SVGProps } from 'react'

interface MoleculeIconProps extends SVGProps<SVGSVGElement> {
  size?: number
  glowIntensity?: 'none' | 'subtle' | 'medium'
}

export function MoleculeIcon({ size = 28, glowIntensity = 'subtle', style, ...props }: MoleculeIconProps) {
  const glowFilter =
    glowIntensity === 'medium'
      ? 'drop-shadow(0 0 5px rgba(255,255,255,0.55)) drop-shadow(0 0 10px rgba(255,255,255,0.2))'
      : glowIntensity === 'subtle'
      ? 'drop-shadow(0 0 3px rgba(255,255,255,0.3))'
      : 'none'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: glowFilter, ...style }}
      {...props}
    >
      {/* Bond: left atom to center */}
      <line x1="7"  y1="15" x2="13" y2="15" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round" />
      {/* Bond: center to right atom */}
      <line x1="15" y1="15" x2="21" y2="15" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round" />
      {/* Bond: center atom up-left to top atom */}
      <line x1="13.5" y1="13" x2="10" y2="8.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round" />
      {/* Bond: center atom up-right to top-right atom */}
      <line x1="14.5" y1="13" x2="19" y2="9" stroke="rgba(255,255,255,0.3)" strokeWidth="1.1" strokeLinecap="round" />

      {/* Top-left atom */}
      <circle cx="9"  cy="7.5" r="2.2" fill="rgba(255,255,255,0.45)" />
      {/* Top-right atom */}
      <circle cx="20" cy="8"   r="1.8" fill="rgba(255,255,255,0.35)" />
      {/* Left atom */}
      <circle cx="5.5" cy="15" r="2.8" fill="rgba(255,255,255,0.45)" />
      {/* Right atom */}
      <circle cx="22.5" cy="15" r="2.4" fill="rgba(255,255,255,0.45)" />
      {/* Center atom (primary — brightest) */}
      <circle cx="14" cy="15" r="3.8" fill="rgba(255,255,255,0.92)" />
      {/* Inner highlight on center atom */}
      <circle cx="12.8" cy="13.8" r="1.1" fill="rgba(255,255,255,0.35)" />
    </svg>
  )
}
