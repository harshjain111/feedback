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
    "alerts": {
      "cluster_count": 3,
      "cluster_window_minutes": 45,
      "complaint_spike_pct": 50,
      "cooldown_minutes": 60,
      "on_follow_up_requested": true,
      "rating_at_or_below": 2
    },
    "branding": {
      "frame_image_url": "/artwork/frame-portrait.webp",
      "instagram_handle": "@allindiacafe",
      "instagram_url": "https://instagram.com/allindiacafe",
      "logo_url": "/brand/logo.webp",
      "name": "All India Café",
      "website_url": "https://allindiacafe.in"
    },
    "comment": {
      "badge": "Optional",
      "h1": "IS THERE ANYTHING ELSE YOU'D LIKE US TO KNOW?",
      "h1_short": "Anything else?",
      "placeholder": "YOUR THOUGHTS...",
      "support": "A compliment, a suggestion or something we could have done better — we'd love to hear it."
    },
    "contact": {
      "cta": "KEEP ME CONNECTED →",
      "cta_hint": "Please add your mobile number so we can reach you.",
      "followup_sub": "Leave your mobile number and a member of our team will personally reach out.",
      "h1": "WE'D LOVE TO STAY CONNECTED ❤️",
      "micro": "We'll use this only to reach you about your visit.",
      "name_label": "Your Name",
      "phone_hint": "10 digits, starting 6-9",
      "phone_label": "Mobile Number",
      "required": true,
      "skip": "SKIP",
      "support": "As a valued customer, we'd love to keep you updated with special offers, new experiences and what's happening at All India Café."
    },
    "footer": {
      "brand": "All India Café",
      "grievance_label": "Grievance Officer",
      "instagram_label": "Instagram",
      "website_label": "Website"
    },
    "grievance": {
      "email": "grievance@allindiacafe.in",
      "h1": "NEED TO SPEAK TO SOMEONE?",
      "name": "Grievance Officer",
      "phone": "+91 00000 00000",
      "support": "Our Grievance Officer is here to listen."
    },
    "kiosk": {
      "idle_seconds": 90,
      "max_writes_per_minute": 15,
      "thanks_seconds": 8
    },
    "memory": {
      "auto_disable_on_failure": true,
      "camera_height": 1080,
      "camera_label": "",
      "camera_width": 1920,
      "caption_line": "Some memories are meant to be carried home.",
      "caption_line_negative": "Come back and let us do better.",
      "collect_message": "Collect it just below the screen.",
      "countdown_seconds": 5,
      "enabled": true,
      "failure_threshold": 3,
      "footer_line": "All India Café",
      "keep_cta": "PRINT IT →",
      "max_retries": 3,
      "mirror_preview": true,
      "negative_offer_body": "Today didn't go the way it should have, and we're working on it. Take a small keepsake with you anyway.",
      "negative_offer_heading": "WE'D LIKE YOU TO LEAVE WITH SOMETHING GOOD",
      "offer_body": "A little keepsake from your visit today. Our gift, no strings.",
      "offer_heading": "BEFORE YOU GO — TAKE A MEMORY WITH YOU",
      "offer_line_welcome": "Share your feedback and take home a memory, on us.",
      "pipeline": {
        "gamma": 1.2,
        "dither": "atkinson",
        "clahe_clip": 2,
        "unsharp_amount": 0.6
      },
      "print_copies": 1,
      "printer_share": "",
      "printing_message": "PRINTING YOUR MEMORY…",
      "privacy_line": "Your photo prints here and is never saved or stored anywhere.",
      "retry_cta": "TAKE ANOTHER",
      "review_heading": "HAPPY WITH THIS ONE?",
      "schedule_enabled": false,
      "schedule_windows": [],
      "skip_cta": "NO THANKS",
      "take_cta": "TAKE A PHOTO →",
      "thermal_logo_url": ""
    },
    "negative": {
      "chips_hint": "Select what needs improvement — you can choose more than one.",
      "h1": "THANK YOU FOR TELLING US.",
      "h2": "WHAT HAPPENED?",
      "h3": "TELL US MORE",
      "sub": "We'd rather know when something wasn't right.",
      "support": "You don't have to explain everything. Even a few words help."
    },
    "positive": {
      "h1": "THAT'S WONDERFUL TO HEAR! ❤️",
      "h2": "WHAT DID YOU LOVE MOST?",
      "sub": "We're glad you had a great experience at All India Café."
    },
    "privacy": {
      "consent_text": "We will only use your number to reach you about your feedback and to share news and offers from All India Café. Ask us any time and we will remove it.",
      "mask_visible_digits": 4,
      "retention_days": null
    },
    "rate": {
      "cta": "CONTINUE →",
      "h1": "HOW DID WE DO?",
      "sub": "Good, bad or somewhere in between — tell us honestly."
    },
    "rewards": {
      "amount": 0,
      "enabled": false,
      "wallet_provider": null
    },
    "thanks": {
      "body": "Your feedback helps us make All India Café better for you — and for everyone who walks through our doors.",
      "h1": "THANK YOU FOR BEING HEARD. ❤️",
      "line": "You spoke. We listened.",
      "support": "We look forward to serving you better next time."
    },
    "thresholds": {
      "category_attention": 3.5,
      "category_drop_pct": 10,
      "category_strong": 4.5,
      "issue_spike_pct": 25,
      "low_rating_cluster_count": 3,
      "min_sample_size": 5,
      "theme_emerging_pct": 30
    },
    "welcome": {
      "cta": "SHARE YOUR FEEDBACK →",
      "h1": "YOUR EXPERIENCE MATTERS.",
      "h2": "Tell us how we did.",
      "micro": "It takes less than a minute.",
      "support": "Your feedback helps us make All India Café better."
    }
  } as const satisfies AppConfig
