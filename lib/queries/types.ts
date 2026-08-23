import type { Comparison } from '@/lib/analytics/comparison'

/**
 * What the query layer returns.
 *
 * Every headline number is a Comparison, not a number (§9). The type is the
 * enforcement: a view cannot render `4.1` without also having `previous`,
 * `delta` and the label saying what it was compared against.
 */

export type Kpis = {
  overall: Comparison
  feedbackCount: Comparison
  positivePct: Comparison
  negativePct: Comparison
  complaintRate: Comparison
  followUpRate: Comparison
  categories: CategoryPerformance[]
}

export type CategoryStatus = 'strong' | 'watch' | 'attention'

export type CategoryPerformance = {
  categoryId: string
  name: string
  icon: string
  score: Comparison
  ratingCount: number
  negativeCount: number
  status: CategoryStatus
}

export type TrendPoint = {
  /** yyyy-MM-dd, Asia/Kolkata. */
  date: string
  /** null on a day with no feedback — the chart shows a gap, never a zero. */
  value: number | null
  count: number
}

export type IssueCount = {
  issueId: string
  name: string
  kind: 'negative' | 'positive'
  mentions: Comparison
}

export type ThemeCount = {
  themeId: string
  name: string
  kind: 'negative' | 'positive'
  feedbackCount: number
  mentions: Comparison
}

export type FeedbackListItem = {
  feedbackId: string
  feedbackCode: string
  submittedAt: string
  localDate: string
  localTime: string
  guestName: string | null
  guestPhoneMasked: string | null
  overallScore: number | null
  sentiment: 'positive' | 'neutral' | 'negative' | null
  ratings: { categoryId: string; name: string; rating: number }[]
  issues: string[]
  commentExcerpt: string | null
  followUpRequested: boolean
  status: string
}

export type FeedbackDetail = FeedbackListItem & {
  /** Always the full, unmodified text (§14.10). */
  comment: string | null
  guestId: string | null
  guestCode: string | null
  followUp: {
    followUpId: string
    status: string
    assignedTo: string | null
    assignedToName: string | null
    resolution: string | null
    createdAt: string
    resolvedAt: string | null
    notes: { noteId: string; authorName: string | null; body: string; createdAt: string }[]
  } | null
}

export type FeedbackFilters = {
  from: string
  to: string
  ratingBand?: 'positive' | 'neutral' | 'negative'
  categoryId?: string
  issueId?: string
  themeId?: string
  followUpRequested?: boolean
  status?: string
  hasComment?: boolean
  guestType?: 'identified' | 'anonymous' | 'repeat'
  search?: string
}

export type Pagination = { page: number; pageSize: number }

export type Paged<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type GuestListItem = {
  guestId: string
  guestCode: string
  name: string | null
  phoneMasked: string | null
  totalFeedbacks: number
  averageRating: number | null
  lastFeedbackDate: string | null
  isRepeat: boolean
  isNegative: boolean
  isHighEngagement: boolean
  hasOpenFollowUp: boolean
}

export type GuestFilterKey = 'all' | 'new' | 'repeat' | 'negative' | 'follow_up' | 'high_engagement'

export type GuestProfile = GuestListItem & {
  firstFeedbackDate: string | null
  categoryAverages: { categoryId: string; name: string; average: number | null }[]
  history: {
    feedbackId: string
    feedbackCode: string
    localDate: string
    overallScore: number | null
    comment: string | null
    ratings: { name: string; rating: number }[]
  }[]
}

export type TodaySnapshot = {
  feedbackCount: Comparison
  avgExperience: Comparison
  positivePct: Comparison
  negativeCount: Comparison
  followUpsRequired: Comparison
}
