/**
 * The shape of the CMS config.
 *
 * This file describes STRUCTURE only. Not one customer-facing string lives
 * here — the values come from app_config at runtime (§3), and the compiled-in
 * fallbacks in config.defaults.ts are generated from the seed migration rather
 * than typed by hand.
 */

export type KioskCopy = {
  welcome: {
    h1: string
    h2: string
    support: string
    cta: string
    micro: string
  }
  rate: {
    h1: string
    /** Load-bearing: this line grants explicit permission to criticise (§5). */
    sub: string
    cta: string
  }
  negative: {
    h1: string
    sub: string
    h2: string
    /** Helper under "WHAT HAPPENED?" — authored, not from §5. */
    chips_hint: string
    h3: string
    support: string
  }
  positive: {
    h1: string
    sub: string
    h2: string
  }
  comment: {
    h1: string
    /** Short label for the comment folded into a branch screen — not from §5. */
    h1_short: string
    support: string
    placeholder: string
    badge: string
  }
  followup: {
    h1: string
    support: string
    yes: string
    /** Second line under the YES button — authored, not from §5. */
    yes_sub: string
    no: string
  }
  contact: {
    h1: string
    support: string
    name_label: string
    phone_label: string
    cta: string
    skip: string
    micro: string
    /** Shown instead of `support` when the guest asked to be followed up. */
    followup_sub: string
    /** Inline hint under the phone field. A hint, never a gate. */
    phone_hint: string
    /**
     * Why the primary button is dimmed. Shown only while it is: guest
     * resolution keys on the phone number (§7), so KEEP ME CONNECTED with no
     * number would store nothing. SKIP is always live either way.
     */
    cta_hint: string
  }
  thanks: {
    h1: string
    body: string
    line: string
    support: string
  }
  grievance: {
    h1: string
    support: string
    name: string
    phone: string
    email: string
  }
  footer: {
    brand: string
    website_label: string
    instagram_label: string
    grievance_label: string
  }
}

export type AppConfig = KioskCopy & {
  branding: {
    name: string
    logo_url: string
    website_url: string
    instagram_url: string
    instagram_handle: string
    /**
     * The full-screen illustrated frame behind every kiosk screen. Defaults to
     * the bundled artwork; set it to swap in a new one without a deploy.
     */
    frame_image_url: string
  }
  kiosk: {
    /** Seconds of inactivity before the journey resets to Welcome (§4). */
    idle_seconds: number
    /** Seconds the thank-you screen holds before auto-reset (§4). */
    thanks_seconds: number
    /** Ceiling on submissions from one kiosk per minute (§42). */
    max_writes_per_minute: number
  }
  thresholds: {
    category_attention: number
    category_strong: number
    category_drop_pct: number
    issue_spike_pct: number
    theme_emerging_pct: number
    low_rating_cluster_count: number
    min_sample_size: number
  }
  alerts: {
    rating_at_or_below: number
    on_follow_up_requested: boolean
    cluster_count: number
    cluster_window_minutes: number
    complaint_spike_pct: number
    cooldown_minutes: number
  }
  rewards: {
    /** §12 — ships false. The journey has the branch point, not the UI. */
    enabled: boolean
    amount: number
    wallet_provider: string | null
  }
  privacy: {
    consent_text: string
    /** null = retain indefinitely. The purge job reads this (§11). */
    retention_days: number | null
    mask_visible_digits: number
  }
}

export type ConfigSection = keyof AppConfig

// -----------------------------------------------------------------------------
// Reference data — DB rows, not config keys
// -----------------------------------------------------------------------------

export type Category = {
  category_id: string
  name: string
  question: string
  icon: string
  display_order: number
}

export type FaceKey = 'angry' | 'sad' | 'neutral' | 'happy' | 'delighted'

export const FACE_KEYS: readonly FaceKey[] = [
  'angry',
  'sad',
  'neutral',
  'happy',
  'delighted',
] as const

export function isFaceKey(value: string): value is FaceKey {
  return (FACE_KEYS as readonly string[]).includes(value)
}

export type RatingFace = {
  scale_id: string
  value: number
  face_key: FaceKey
  label: string
  colour: string
}

export type IssueKind = 'negative' | 'positive'

export type Issue = {
  issue_id: string
  name: string
  icon: string | null
  kind: IssueKind
  display_order: number
}

export type Theme = {
  theme_id: string
  name: string
  kind: IssueKind
  display_order: number
  keywords: string[]
}
