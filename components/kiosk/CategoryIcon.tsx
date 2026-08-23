import {
  Armchair,
  ConciergeBell,
  Coffee,
  Heart,
  HeartHandshake,
  Music,
  ReceiptIndianRupee,
  Smile,
  Sparkles,
  SprayCan,
  Timer,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/**
 * Resolves a `categories.icon` / `issues.icon` value to a lucide icon.
 *
 * A curated map rather than lucide's dynamic `icons` export: that export pulls
 * the entire icon library into the bundle, which §6 forbids on the kiosk.
 * Unknown names fall back rather than breaking the screen, and the settings
 * page offers this list as a picker instead of a free-text field.
 *
 * `size` is in design px and rendered through --kpx, so icons scale with the
 * screen like everything else.
 */
const ICONS: Record<string, LucideIcon> = {
  utensils: UtensilsCrossed,
  'concierge-bell': ConciergeBell,
  'heart-handshake': HeartHandshake,
  sparkles: Sparkles,
  coffee: Coffee,
  timer: Timer,
  users: Users,
  'user-round': UserRound,
  wallet: Wallet,
  'receipt-indian-rupee': ReceiptIndianRupee,
  music: Music,
  smile: Smile,
  armchair: Armchair,
  'spray-can': SprayCan,
  heart: Heart,
}

export const AVAILABLE_ICONS = Object.keys(ICONS)

export function CategoryIcon({
  name,
  className,
  size = 40,
}: {
  name: string
  className?: string
  size?: number
}) {
  const Icon = ICONS[name] ?? Smile
  const dimension = `calc(${size} * var(--kpx))`

  return (
    <Icon
      className={className}
      style={{ width: dimension, height: dimension }}
      strokeWidth={1.7}
      aria-hidden="true"
    />
  )
}
