import Link from 'next/link'
import { cn } from '@/lib/cn'

/**
 * The kiosk's one obvious CTA (§6).
 *
 * Tap targets are 88px minimum; primary buttons run much larger than that
 * because a standing guest hits them without aiming. Labels always come from
 * config — this component never contains copy.
 */

type Variant = 'primary' | 'secondary' | 'quiet'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-hover shadow-none',
  secondary: 'bg-surface text-ink border-2 border-line-strong hover:border-ink-muted',
  // For SKIP: always visible and equally reachable, never a tiny grey link (§5).
  quiet: 'bg-transparent text-ink-soft border-2 border-transparent hover:border-line-strong',
}

type CommonProps = {
  children: React.ReactNode
  variant?: Variant
  className?: string
  fullWidth?: boolean
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

function classes(variant: Variant, fullWidth: boolean, className?: string) {
  return cn(
    'inline-flex min-h-[88px] items-center justify-center gap-3 rounded-button px-12 py-6',
    'font-sans text-k-h3 font-semibold tracking-wide',
    'transition-colors duration-[--duration-kiosk] ease-[--ease-kiosk]',
    'focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-accent',
    'disabled:cursor-not-allowed disabled:opacity-35',
    fullWidth && 'w-full',
    VARIANTS[variant],
    className,
  )
}

export function BigButton(props: ButtonProps | LinkProps) {
  const { children, variant = 'primary', className, fullWidth = false } = props

  if ('href' in props && props.href !== undefined) {
    return (
      <Link
        href={props.href}
        onClick={props.onClick}
        className={classes(variant, fullWidth, className)}
      >
        {children}
      </Link>
    )
  }

  const { onClick, disabled, type = 'button' } = props as ButtonProps
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes(variant, fullWidth, className)}
    >
      {children}
    </button>
  )
}
