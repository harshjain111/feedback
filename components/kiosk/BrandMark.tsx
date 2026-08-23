/**
 * The café's mark, at the top of every kiosk screen.
 *
 * Drawn rather than imported so the kiosk has a brand presence out of the box
 * with nothing to load — but `branding.logo_url` overrides it the moment a real
 * logo is set in Settings, with no code change. The drawn version is a
 * placeholder for the client's actual mark, not a substitute for it.
 */
export function BrandMark({
  logoUrl,
  name,
  size = 96,
}: {
  logoUrl?: string
  name: string
  size?: number
}) {
  const px = (n: number) => `calc(${n} * var(--kpx))`

  if (logoUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element --
         The logo URL is arbitrary CMS input; next/image would need a remote
         pattern configured per client, and the mark is a small static asset. */
      <img
        src={logoUrl}
        alt={name}
        style={{ height: px(size), width: 'auto' }}
        className="object-contain"
      />
    )
  }

  return (
    <span
      className="inline-flex flex-col items-center justify-center"
      style={{ width: px(size), height: px(size) }}
      role="img"
      aria-label={name}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        {/* Double rule, the way a café stamp is set. */}
        <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="0.8" />

        {/* A cup, reduced to three strokes. */}
        <path
          d="M35 44 h26 v11 a13 13 0 0 1 -26 0 z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <path
          d="M61 47 h4.5 a5 5 0 0 1 0 10 H61"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Steam. */}
        <path
          d="M43 36 q3 -4 0 -8 M50 36 q3 -5 0 -9 M57 36 q3 -4 0 -8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.8"
        />
        <path d="M30 70 h40" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  )
}
