/**
 * GENERATED FILE — do not edit by hand.
 *
 * Fallback values for getConfig(), derived from supabase/migrations/0002_seed.sql.
 * Regenerate with:  pnpm gen:config
 *
 * These are a safety net, not the source of truth. The database is authoritative
 * and the CMS is the only place copy may be changed (§3).
 */
import type { AppConfig } from './config.types'

export const CONFIG_DEFAULTS: AppConfig = {
  alerts: {
    cluster_count: 3,
    cluster_window_minutes: 45,
    complaint_spike_pct: 50,
    cooldown_minutes: 60,
    on_follow_up_requested: true,
    rating_at_or_below: 2,
  },
  branding: {
    frame_image_url: '/artwork/frame-portrait.webp',
    instagram_handle: '@allindiacafe',
    instagram_url: 'https://instagram.com/allindiacafe',
    logo_url: '',
    name: 'All India Café',
    website_url: 'https://allindiacafe.in',
  },
  comment: {
    badge: 'Optional',
    h1: "IS THERE ANYTHING ELSE YOU'D LIKE US TO KNOW?",
    placeholder: 'YOUR THOUGHTS...',
    support:
      "A compliment, a suggestion or something we could have done better — we'd love to hear it.",
  },
  contact: {
    cta: 'KEEP ME CONNECTED →',
    followup_sub: 'Leave your mobile number and a member of our team will personally reach out.',
    h1: "WE'D LOVE TO STAY CONNECTED ❤️",
    micro: 'Optional — you can skip this step.',
    name_label: 'Your Name',
    phone_hint: '10 digits, starting 6-9',
    phone_label: 'Mobile Number',
    skip: 'SKIP',
    support:
      "As a valued customer, we'd love to keep you updated with special offers, new experiences and what's happening at All India Café.",
  },
  followup: {
    h1: 'WOULD YOU LIKE US TO FOLLOW UP?',
    no: "NO, I'M GOOD",
    support: "If you'd like, a member of our team can personally reach out to you.",
    yes: 'YES, PLEASE',
    yes_sub: 'I would like to hear from you',
  },
  footer: {
    brand: 'All India Café',
    grievance_label: 'Grievance Officer',
    instagram_label: 'Instagram',
    website_label: 'Website',
  },
  grievance: {
    email: 'grievance@allindiacafe.in',
    h1: 'NEED TO SPEAK TO SOMEONE?',
    name: 'Grievance Officer',
    phone: '+91 00000 00000',
    support: 'Our Grievance Officer is here to listen.',
  },
  kiosk: {
    idle_seconds: 90,
    max_writes_per_minute: 15,
    thanks_seconds: 8,
  },
  negative: {
    chips_hint: 'Select what needs improvement — you can choose more than one.',
    h1: 'THANK YOU FOR TELLING US.',
    h2: 'WHAT HAPPENED?',
    h3: 'TELL US MORE',
    sub: "We'd rather know when something wasn't right.",
    support: "You don't have to explain everything. Even a few words help.",
  },
  positive: {
    h1: "THAT'S WONDERFUL TO HEAR! ❤️",
    h2: 'WHAT DID YOU LOVE MOST?',
    sub: "We're glad you had a great experience at All India Café.",
  },
  privacy: {
    consent_text:
      'We will only use your number to reach you about your feedback and to share news and offers from All India Café. Ask us any time and we will remove it.',
    mask_visible_digits: 4,
    retention_days: null,
  },
  rate: {
    cta: 'CONTINUE →',
    h1: 'HOW DID WE DO?',
    sub: 'Good, bad or somewhere in between — tell us honestly.',
  },
  rewards: {
    amount: 0,
    enabled: false,
    wallet_provider: null,
  },
  thanks: {
    body: 'Your feedback helps us make All India Café better for you — and for everyone who walks through our doors.',
    h1: 'THANK YOU FOR BEING HEARD. ❤️',
    line: 'You spoke. We listened.',
    support: 'We look forward to serving you better next time.',
  },
  thresholds: {
    category_attention: 3.5,
    category_drop_pct: 10,
    category_strong: 4.5,
    issue_spike_pct: 25,
    low_rating_cluster_count: 3,
    min_sample_size: 5,
    theme_emerging_pct: 30,
  },
  welcome: {
    cta: 'SHARE YOUR FEEDBACK →',
    h1: 'YOUR EXPERIENCE MATTERS.',
    h2: 'Tell us how we did.',
    micro: 'It takes less than a minute.',
    support: 'Your feedback helps us make All India Café better.',
  },
} as const satisfies AppConfig
