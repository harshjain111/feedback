/**
 * GENERATED FILE — do not edit by hand.
 *
 * The seeded reference rows, derived from supabase/migrations/0002_seed.sql.
 * Regenerate with:  pnpm gen:config
 *
 * Used only when Supabase is unconfigured outside production, so the kiosk can
 * be rendered and reviewed locally. The database is always authoritative.
 */
import type { Category, Issue, RatingFace, Theme } from './config.types'

export const REFERENCE_DEFAULTS: {
  categories: Category[]
  ratingScale: RatingFace[]
  issues: Issue[]
  themes: Theme[]
} = {
  categories: [
    {
      category_id: 'offline-category-food',
      name: 'FOOD',
      question: 'How did your food make you feel?',
      icon: 'utensils',
      display_order: 1,
    },
    {
      category_id: 'offline-category-service',
      name: 'SERVICE',
      question: 'How was the service you received?',
      icon: 'concierge-bell',
      display_order: 2,
    },
    {
      category_id: 'offline-category-hospitality',
      name: 'HOSPITALITY',
      question: 'How did our team make you feel?',
      icon: 'heart-handshake',
      display_order: 3,
    },
    {
      category_id: 'offline-category-ambience',
      name: 'AMBIENCE',
      question: 'How did you find the ambience & cleanliness?',
      icon: 'sparkles',
      display_order: 4,
    },
  ],
  ratingScale: [
    {
      scale_id: 'offline-scale-1',
      value: 1,
      face_key: 'angry',
      label: 'Very Poor',
      colour: '#E63329',
    },
    {
      scale_id: 'offline-scale-2',
      value: 2,
      face_key: 'sad',
      label: 'Poor',
      colour: '#F07829',
    },
    {
      scale_id: 'offline-scale-3',
      value: 3,
      face_key: 'neutral',
      label: 'Okay',
      colour: '#F5C518',
    },
    {
      scale_id: 'offline-scale-4',
      value: 4,
      face_key: 'happy',
      label: 'Good',
      colour: '#8DC63F',
    },
    {
      scale_id: 'offline-scale-5',
      value: 5,
      face_key: 'delighted',
      label: 'Excellent',
      colour: '#39B54A',
    },
  ],
  issues: [
    {
      issue_id: 'offline-issue-negative-food',
      name: 'Food',
      icon: 'utensils',
      kind: 'negative',
      display_order: 1,
    },
    {
      issue_id: 'offline-issue-negative-service',
      name: 'Service',
      icon: 'concierge-bell',
      kind: 'negative',
      display_order: 2,
    },
    {
      issue_id: 'offline-issue-negative-staff',
      name: 'Staff',
      icon: 'user-round',
      kind: 'negative',
      display_order: 3,
    },
    {
      issue_id: 'offline-issue-negative-waiting-time',
      name: 'Waiting Time',
      icon: 'timer',
      kind: 'negative',
      display_order: 4,
    },
    {
      issue_id: 'offline-issue-negative-cleanliness',
      name: 'Cleanliness',
      icon: 'spray-can',
      kind: 'negative',
      display_order: 5,
    },
    {
      issue_id: 'offline-issue-negative-billing',
      name: 'Billing',
      icon: 'receipt-indian-rupee',
      kind: 'negative',
      display_order: 6,
    },
    {
      issue_id: 'offline-issue-negative-ambience',
      name: 'Ambience',
      icon: 'armchair',
      kind: 'negative',
      display_order: 7,
    },
    {
      issue_id: 'offline-issue-positive-food',
      name: 'Food',
      icon: 'utensils',
      kind: 'positive',
      display_order: 1,
    },
    {
      issue_id: 'offline-issue-positive-service',
      name: 'Service',
      icon: 'concierge-bell',
      kind: 'positive',
      display_order: 2,
    },
    {
      issue_id: 'offline-issue-positive-our-team',
      name: 'Our Team',
      icon: 'users',
      kind: 'positive',
      display_order: 3,
    },
    {
      issue_id: 'offline-issue-positive-ambience',
      name: 'Ambience',
      icon: 'armchair',
      kind: 'positive',
      display_order: 4,
    },
    {
      issue_id: 'offline-issue-positive-the-experience',
      name: 'The Experience',
      icon: 'sparkles',
      kind: 'positive',
      display_order: 5,
    },
  ],
  themes: [
    {
      theme_id: 'offline-theme-negative-waiting',
      name: 'Waiting',
      kind: 'negative',
      display_order: 1,
      keywords: [
        'delay',
        'delayed',
        'late',
        'long time',
        'queue',
        'slow',
        'wait',
        'waited',
        'waiting',
      ],
    },
    {
      theme_id: 'offline-theme-negative-cold-food',
      name: 'Cold Food',
      kind: 'negative',
      display_order: 2,
      keywords: ['cold', 'lukewarm', 'not hot', 'tepid'],
    },
    {
      theme_id: 'offline-theme-negative-billing',
      name: 'Billing',
      kind: 'negative',
      display_order: 3,
      keywords: [
        'bill',
        'billing',
        'charge',
        'charged',
        'extra charge',
        'invoice',
        'overcharge',
        'overcharged',
      ],
    },
    {
      theme_id: 'offline-theme-negative-taste',
      name: 'Taste',
      kind: 'negative',
      display_order: 4,
      keywords: ['bland', 'burnt', 'oily', 'salty', 'spicy', 'taste', 'tasteless', 'undercooked'],
    },
    {
      theme_id: 'offline-theme-negative-staff',
      name: 'Staff',
      kind: 'negative',
      display_order: 5,
      keywords: ['attitude', 'ignored', 'impolite', 'no one came', 'rude', 'unfriendly'],
    },
    {
      theme_id: 'offline-theme-negative-cleanliness',
      name: 'Cleanliness',
      kind: 'negative',
      display_order: 6,
      keywords: ['dirty', 'hygiene', 'messy', 'smell', 'smelly', 'toilet', 'unclean', 'washroom'],
    },
    {
      theme_id: 'offline-theme-negative-portion',
      name: 'Portion',
      kind: 'negative',
      display_order: 7,
      keywords: ['less quantity', 'portion', 'quantity', 'small portion'],
    },
    {
      theme_id: 'offline-theme-negative-value',
      name: 'Value',
      kind: 'negative',
      display_order: 8,
      keywords: ['costly', 'expensive', 'not worth', 'overpriced'],
    },
    {
      theme_id: 'offline-theme-negative-noise',
      name: 'Noise',
      kind: 'negative',
      display_order: 9,
      keywords: ['crowded', 'loud', 'noisy'],
    },
    {
      theme_id: 'offline-theme-positive-delicious',
      name: 'Delicious',
      kind: 'positive',
      display_order: 1,
      keywords: [
        'amazing food',
        'delicious',
        'flavorful',
        'flavourful',
        'great food',
        'tasty',
        'yummy',
      ],
    },
    {
      theme_id: 'offline-theme-positive-warm-service',
      name: 'Warm Service',
      kind: 'positive',
      display_order: 2,
      keywords: ['attentive', 'courteous', 'friendly', 'helpful', 'polite', 'welcoming'],
    },
    {
      theme_id: 'offline-theme-positive-fast-service',
      name: 'Fast Service',
      kind: 'positive',
      display_order: 3,
      keywords: ['fast', 'on time', 'prompt', 'quick'],
    },
    {
      theme_id: 'offline-theme-positive-ambience',
      name: 'Ambience',
      kind: 'positive',
      display_order: 4,
      keywords: ['ambiance', 'ambience', 'beautiful', 'cosy', 'cozy', 'music', 'vibe'],
    },
    {
      theme_id: 'offline-theme-positive-value',
      name: 'Value',
      kind: 'positive',
      display_order: 5,
      keywords: ['affordable', 'reasonable', 'value for money', 'worth it'],
    },
    {
      theme_id: 'offline-theme-positive-cleanliness',
      name: 'Cleanliness',
      kind: 'positive',
      display_order: 6,
      keywords: ['clean', 'hygienic', 'spotless', 'well maintained'],
    },
  ],
}
