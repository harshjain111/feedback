import {
  ConciergeBell,
  Coffee,
  HeartHandshake,
  Music,
  ReceiptIndianRupee,
  Smile,
  Sparkles,
  Timer,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/**
 * Resolves a `categories.icon` value to a lucide icon.
 *
 * A curated map rather than lucide's dynamic `icons` export on purpose: that
 * export pulls the entire icon library into the bundle, and §6 says no heavy
 * libraries on the kiosk. Unknown names fall back to a neutral mark instead of
 * breaking the screen — the settings page (Prompt 37) should offer this list as
 * a picker rather than a free-text field.
 */
const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  'concierge-bell': ConciergeBell,
  'heart-handshake': HeartHandshake,
  sparkles: Sparkles,
  coffee: Coffee,
  timer: Timer,
  users: Users,
  wallet: Wallet,
  'receipt-indian-rupee': ReceiptIndianRupee,
  music: Music,
  smile: Smile,
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
  return <Icon className={className} size={size} strokeWidth={1.6} aria-hidden="true" />
}
