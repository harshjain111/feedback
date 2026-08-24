import Link from 'next/link'
import { cn } from '@/lib/cn'

/**
 * The kiosk's one obvious CTA (§6).
 *
 * Sized in design px through --kpx so the button is the same proportion of the
 * screen on any tablet, and always clears the 88px minimum tap target.
 */

type Variant = 'primary' | 'secondary' | 'quiet'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-hover',
  secondary: 'bg-surface text-ink border-line-strong border-2',
  // SKIP: always visible and equally reachable, never a tiny grey link (§5).
  quiet: 'bg-transparent text-ink-soft border-2 border-transparent',
}

type CommonProps = {
  children: React.ReactNode
  variant?: Variant
  className?: string
  fullWidth?: boolean
  /** Optional second line, as on the follow-up screen in the reference. */
  subLabel?: string
  icon?: React.ReactNode
  /**
   * Multiplier on the whole button — label, padding and minimum height together.
   *
   * Scaled as a group rather than by a CSS transform, so the tap target grows
   * with the picture. A transform would leave a 104px hit area sitting under a
   * larger-looking button, which is the kind of thing nobody notices until a
   * guest taps the edge and nothing happens.
   */
  scale?: number
}

type ButtonProps = CommonProps & {
  href?: undefined
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}

type LinkProps = CommonProps & {
  href: string
  onClick?: () => void
}

function Inner({
  children,
  subLabel,
  icon,
  scale = 1,
}: {
  children: React.ReactNode
  subLabel?: string
  icon?: React.ReactNode
  scale?: number
}) {
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ gap: 'calc(12 * var(--kpx))' }}
    >
      {icon}
      <span className="flex flex-col items-center leading-tight">
        <span
          className="text-k-h3 font-semibold tracking-wide"
          // text-k-h3 is 40 design px; restate it scaled rather than adding a
          // second size token for one button.
          style={scale === 1 ? undefined : { fontSize: `calc(40 * ${scale} * var(--kpx))` }}
        >
          {children}
        </span>
        {subLabel ? <span className="text-k-micro font-normal opacity-80">{subLabel}</span> : null}
      </span>
    </span>
  )
}

function classes(variant: Variant, fullWidth: boolean, className?: string) {
  return cn(
    'k-tap inline-flex items-center justify-center rounded-[--radius-button]',
    'font-sans transition-colors duration-[--duration-kiosk] ease-[--ease-kiosk]',
    'focus-visible:outline-accent focus-visible:outline-4 focus-visible:outline-offset-4',
    'disabled:cursor-not-allowed disabled:opacity-35',
    fullWidth && 'w-full',
    VARIANTS[variant],
    className,
  )
}

export function BigButton(props: ButtonProps | LinkProps) {
  const {
    children,
    variant = 'primary',
    className,
    fullWidth = false,
    subLabel,
    icon,
    scale = 1,
  } = props

  const padding = {
    paddingInline: `calc(40 * ${scale} * var(--kpx))`,
    paddingBlock: `calc(22 * ${scale} * var(--kpx))`,
    // k-tap and k-cta set their minimums in CSS; a scaled button has to restate
    // them or it would shrink back to the unscaled floor.
    ...(scale === 1
      ? {}
      : { minHeight: `calc(120 * ${scale} * var(--kpx))`, minWidth: `calc(104 * ${scale} * var(--kpx))` }),
  }

  if ('href' in props && props.href !== undefined) {
    return (
      <Link
        href={props.href}
        onClick={props.onClick}
        style={padding}
        className={classes(variant, fullWidth, className)}
      >
        <Inner subLabel={subLabel} icon={icon} scale={scale}>
          {children}
        </Inner>
      </Link>
    )
  }

  const { onClick, disabled, type = 'button' } = props as ButtonProps
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={padding}
      className={classes(variant, fullWidth, className)}
    >
      <Inner subLabel={subLabel} icon={icon} scale={scale}>
        {children}
      </Inner>
    </button>
  )
}
