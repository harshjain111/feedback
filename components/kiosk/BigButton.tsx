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
}: {
  children: React.ReactNode
  subLabel?: string
  icon?: React.ReactNode
}) {
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ gap: 'calc(12 * var(--kpx))' }}
    >
      {icon}
      <span className="flex flex-col items-center leading-tight">
        <span className="text-k-h3 font-semibold tracking-wide">{children}</span>
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
  const { children, variant = 'primary', className, fullWidth = false, subLabel, icon } = props
  const padding = {
    paddingInline: 'calc(40 * var(--kpx))',
    paddingBlock: 'calc(22 * var(--kpx))',
  }

  if ('href' in props && props.href !== undefined) {
    return (
      <Link
        href={props.href}
        onClick={props.onClick}
        style={padding}
        className={classes(variant, fullWidth, className)}
      >
        <Inner subLabel={subLabel} icon={icon}>
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
      <Inner subLabel={subLabel} icon={icon}>
        {children}
      </Inner>
    </button>
  )
}
