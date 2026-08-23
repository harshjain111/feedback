import type { FaceKey } from '@/lib/config.types'

/**
 * One rating face, drawn as inline SVG (CLAUDE.md §5).
 *
 * Never a Unicode emoji: 😠 renders as a different drawing on every OS and
 * tablet font stack, and the client approved a specific look. The guest must
 * see exactly the same five faces every time.
 *
 * Visual spec, from the approved reference:
 *   - solid filled circle, no outline, no gradient, no shadow
 *   - eyes and mouth are WHITE negative space cut out of the circle
 *   - eyes are simple ovals; the mouth is one thick stroke or filled shape
 *   - eyebrows on `angry` and `sad` only
 *   - flat and friendly — no 3D shading, bevel or gloss
 *
 * The colour always comes from the caller (a rating_scale row), never from a
 * constant here: the ramp is CMS-editable.
 */

type FaceIconProps = {
  faceKey: FaceKey
  /** Hex from the rating_scale row. */
  colour: string
  /** Rendered size in px. Kiosk taps need >= 140 (§6). */
  size?: number
  className?: string
  title?: string
}

const CUT = '#ffffff'

/** Eyes shared by the first four faces — simple ovals. */
function OvalEyes() {
  return (
    <>
      <ellipse cx="35" cy="41" rx="6.5" ry="9" fill={CUT} />
      <ellipse cx="65" cy="41" rx="6.5" ry="9" fill={CUT} />
    </>
  )
}

function Features({ faceKey }: { faceKey: FaceKey }) {
  switch (faceKey) {
    case 'angry':
      return (
        <>
          {/* Furrowed, angled inward and down. */}
          <path d="M22 27 L44 36" stroke={CUT} strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M78 27 L56 36" stroke={CUT} strokeWidth="7" strokeLinecap="round" fill="none" />
          <OvalEyes />
          {/* Deep frown. */}
          <path
            d="M28 76 Q50 52 72 76"
            stroke={CUT}
            strokeWidth="7.5"
            strokeLinecap="round"
            fill="none"
          />
        </>
      )

    case 'sad':
      return (
        <>
          {/* Flat brows. */}
          <path d="M24 29 H44" stroke={CUT} strokeWidth="6" strokeLinecap="round" />
          <path d="M56 29 H76" stroke={CUT} strokeWidth="6" strokeLinecap="round" />
          <OvalEyes />
          {/* Shallow frown. */}
          <path
            d="M30 73 Q50 61 70 73"
            stroke={CUT}
            strokeWidth="6.5"
            strokeLinecap="round"
            fill="none"
          />
        </>
      )

    case 'neutral':
      return (
        <>
          <OvalEyes />
          {/* Straight horizontal mouth. */}
          <path d="M32 68 H68" stroke={CUT} strokeWidth="6.5" strokeLinecap="round" />
        </>
      )

    case 'happy':
      return (
        <>
          <OvalEyes />
          {/* Gentle upward smile. */}
          <path
            d="M31 63 Q50 77 69 63"
            stroke={CUT}
            strokeWidth="6.5"
            strokeLinecap="round"
            fill="none"
          />
        </>
      )

    case 'delighted':
      return (
        <>
          {/* Curved-arc closed eyes. */}
          <path
            d="M25 44 Q35 31 45 44"
            stroke={CUT}
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M55 44 Q65 31 75 44"
            stroke={CUT}
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          {/* Wide open smile — a filled shape, not a stroke. */}
          <path d="M26 58 A24 24 0 0 0 74 58 Z" fill={CUT} />
        </>
      )
  }
}

export function FaceIcon({ faceKey, colour, size = 140, className, title }: FaceIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <circle cx="50" cy="50" r="50" fill={colour} />
      <Features faceKey={faceKey} />
    </svg>
  )
}
