'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import type { Category, Issue } from '@/lib/config.types'

/**
 * Filters for the feedback list (§29).
 *
 * Everything lives in searchParams, which is what makes the insight cards work:
 * a card's VIEW FEEDBACK link is just this page with the same params set, so
 * there is one filter implementation rather than one for humans and one for
 * deep links.
 */

const RATING_BANDS = [
  { value: '', label: 'Any rating' },
  { value: 'negative', label: 'Negative (1–2)' },
  { value: 'neutral', label: 'Neutral (3)' },
  { value: 'positive', label: 'Positive (4–5)' },
]

const STATUSES = ['', 'NEW', 'OPEN', 'CONTACTED', 'RESOLVED', 'CLOSED']

const GUEST_TYPES = [
  { value: '', label: 'Any guest' },
  { value: 'identified', label: 'Identified' },
  { value: 'anonymous', label: 'Anonymous' },
]

function Select({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-ink-muted text-[11px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-line-strong bg-surface text-ink focus:border-accent rounded-lg border px-2.5 py-1.5 text-sm outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FeedbackFilters({
  categories,
  issues,
}: {
  categories: Category[]
  issues: Issue[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const get = (key: string) => searchParams.get(key) ?? ''

  const set = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === '') params.delete(key)
    else params.set(key, value)
    // Any filter change invalidates the current page number.
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  // The date range is owned by the header filter, so it is preserved rather
  // than cleared — "clear filters" should not silently reset the period too.
  const FILTER_KEYS = [
    'ratingBand',
    'categoryId',
    'issueId',
    'themeId',
    'status',
    'followUp',
    'hasComment',
    'guestType',
    'q',
    'page',
  ]

  const active = FILTER_KEYS.filter((key) => searchParams.get(key))

  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of FILTER_KEYS) params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="border-line bg-surface rounded-2xl border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          name="ratingBand"
          label="Rating"
          value={get('ratingBand')}
          options={RATING_BANDS}
          onChange={(value) => set('ratingBand', value)}
        />
        <Select
          name="categoryId"
          label="Category"
          value={get('categoryId')}
          options={[
            { value: '', label: 'All categories' },
            ...categories.map((category) => ({
              value: category.category_id,
              label: category.name,
            })),
          ]}
          onChange={(value) => set('categoryId', value)}
        />
        <Select
          name="issueId"
          label="Issue"
          value={get('issueId')}
          options={[
            { value: '', label: 'All issues' },
            ...issues.map((issue) => ({ value: issue.issue_id, label: issue.name })),
          ]}
          onChange={(value) => set('issueId', value)}
        />
        <Select
          name="status"
          label="Status"
          value={get('status')}
          options={STATUSES.map((status) => ({
            value: status,
            label: status === '' ? 'Any status' : status,
          }))}
          onChange={(value) => set('status', value)}
        />
        <Select
          name="followUp"
          label="Follow-up"
          value={get('followUp')}
          options={[
            { value: '', label: 'Any' },
            { value: 'true', label: 'Requested' },
            { value: 'false', label: 'Not requested' },
          ]}
          onChange={(value) => set('followUp', value)}
        />
        <Select
          name="hasComment"
          label="Comment"
          value={get('hasComment')}
          options={[
            { value: '', label: 'Any' },
            { value: 'true', label: 'Has a comment' },
            { value: 'false', label: 'No comment' },
          ]}
          onChange={(value) => set('hasComment', value)}
        />
        <Select
          name="guestType"
          label="Guest"
          value={get('guestType')}
          options={GUEST_TYPES}
          onChange={(value) => set('guestType', value)}
        />

        <label className="flex flex-col gap-1">
          <span className="text-ink-muted text-[11px] font-medium tracking-wide uppercase">
            Search comments
          </span>
          <input
            type="search"
            defaultValue={get('q')}
            onKeyDown={(event) => {
              if (event.key === 'Enter') set('q', event.currentTarget.value.trim())
            }}
            onBlur={(event) => {
              if (event.target.value.trim() !== get('q')) set('q', event.target.value.trim())
            }}
            placeholder="e.g. waiting"
            className="border-line-strong bg-surface text-ink focus:border-accent rounded-lg border px-2.5 py-1.5 text-sm outline-none"
          />
        </label>

        {active.length > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="border-line text-ink-soft hover:bg-ground-sunk mb-0.5 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs"
          >
            <X size={13} strokeWidth={2.2} aria-hidden="true" />
            Clear {active.length} filter{active.length === 1 ? '' : 's'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
