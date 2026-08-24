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
  /*
   * There is no `followup` section. The brief's §11 screen is cut (CLAUDE.md
   * §4) and its five strings were deleted in 0013 rather than left seeded: a
   * config key with no screen behind it is a CMS field a manager can edit to no
   * effect, which is worse than a missing one.
   *
   * `contact.followup_sub` below is a different thing and still live — the
   * variant subheading shown on the contact screen when the visit went badly.
   */
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
  /**
   * Memory Print Module — PHOTO_MODULE.md.
   *
   * Note what is NOT here: anything to do with storing, uploading or retaining
   * an image. There is no bucket key, no retention window, no upload endpoint,
   * because the photo has no path off the kiosk (Rule 2). If a field for one
   * ever seems necessary, the design has gone wrong rather than the type.
   */
  memory: MemoryConfig
}

/** One window the module is allowed to run in (§8b, layer 3). */
export type ScheduleWindow = {
  /** 0 = Sunday. Empty means every day. */
  days: number[]
  /** 24h local time, "HH:MM". */
  from: string
  to: string
}

export type MemoryPipelineConfig = {
  /** Local contrast. THE step that makes faces legible at 1-bit (§4). */
  clahe_clip: number
  /** > 1 because thermal heads over-deposit and prints run dark. */
  gamma: number
  unsharp_amount: number
  /**
   * 'atkinson' diffuses only 3/4 of the error, so highlights blow clean white
   * and shadows go solid black — punchy and graphic. Floyd–Steinberg diffuses
   * all of it and goes grey and muddy on thermal paper. This choice is the
   * product's look, not a tuning preference (§4).
   */
  dither: 'atkinson' | 'floyd-steinberg'
}

export type MemoryConfig = {
  // --- kill switch, three layers (§8b) ---------------------------------------
  /**
   * Master. false removes the module from the journey entirely — no offer line,
   * no route, and the camera is never requested, so no permission prompt and no
   * LED. A guest on a disabled kiosk must not be able to tell it exists.
   *
   * Never cache this in client state across journeys: the kiosk re-reads config
   * at the start of every journey precisely so a manager's toggle lands within
   * seconds.
   */
  enabled: boolean
  /** Self-disable after `failure_threshold` consecutive print failures. */
  auto_disable_on_failure: boolean
  failure_threshold: number
  schedule_enabled: boolean
  schedule_windows: ScheduleWindow[]

  // --- capture (§3) ----------------------------------------------------------
  countdown_seconds: number
  /** Retakes before KEEP is the only option. Guards the exit rush. */
  max_retries: number

  // --- copy (§9), all CMS-editable per CLAUDE.md §3 --------------------------
  offer_line_welcome: string
  offer_heading: string
  offer_body: string
  take_cta: string
  skip_cta: string
  /** Rule 2, stated on screen before the guest decides — not in a policy page. */
  privacy_line: string
  /**
   * Shown instead of the standard offer when the visit went badly. Sincere
   * register, same gift. §14.3 forbids it being a lesser one.
   */
  negative_offer_heading: string
  negative_offer_body: string
  review_heading: string
  retry_cta: string
  keep_cta: string
  printing_message: string
  collect_message: string

  // --- what is printed on the paper (§5) -------------------------------------
  caption_line: string
  caption_line_negative: string
  footer_line: string
  /**
   * A hand-prepared 1-bit bitmap, separate from `branding.logo_url`. Thin
   * strokes and gradients disappear at 203dpi, so auto-converting the web logo
   * yields a grey smear. Empty until someone prepares one.
   */
  thermal_logo_url: string

  pipeline: MemoryPipelineConfig
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
