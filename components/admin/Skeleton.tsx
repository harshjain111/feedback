import { cn } from '@/lib/cn'

/**
 * Loading placeholders for the admin.
 *
 * Every page here is `force-dynamic` and every query is a live round trip to
 * Postgres, so there is a real beat between clicking a nav link and seeing
 * numbers. Without a skeleton that beat looks like a frozen app, and the
 * complaint that lands is "it's slow" even when the query is fast.
 *
 * These mirror the real layout — same card sizes, same grid — so the page does
 * not jump when the data lands. A generic spinner would be less work and worse:
 * it tells the reader something is happening but not what is coming.
 */

export function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={cn('animate-pulse rounded-lg', className)}
      style={{ background: 'var(--color-ground-sunk)', ...style }}
    />
  )
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="border-line bg-surface rounded-2xl border p-5">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-4 h-8 w-20" />
      {Array.from({ length: lines - 1 }, (_, index) => (
        <Skeleton key={index} className="mt-2.5 h-3 w-32" />
      ))}
    </div>
  )
}

/** The dashboard: KPI row, insight pair, two charts. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-2 h-3.5 w-40" />
        </div>
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <div className="border-line bg-surface rounded-2xl border p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-[236px] w-full rounded-xl" />
        </div>
        <div className="border-line bg-surface rounded-2xl border p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mx-auto mt-4 h-44 w-44 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/** Anything list-shaped: feedback, guests, users. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="border-line bg-surface space-y-3 rounded-2xl border p-5">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The feedback list while its rows are being fetched.
 *
 * Shaped like the real thing — score disc, two lines of text, a status pill —
 * so the page does not jump when the data lands. A spinner would say "something
 * is happening"; this says what is coming.
 */
export function FeedbackListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="border-line bg-surface divide-line divide-y rounded-2xl border"
      aria-busy="true"
      aria-label="Loading feedback"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-44" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="hidden h-6 w-64 rounded-full lg:block" />
          <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** The shell header while the outlet and device health are still loading. */
export function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-6 w-28 rounded-full" />
      <Skeleton className="h-6 w-28 rounded-full" />
    </div>
  )
}

/** Analytics: a KPI strip and a stack of chart panels, not a table. */
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-3.5 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartPanelSkeleton />
        <ChartPanelSkeleton />
      </div>
      <ChartPanelSkeleton height={280} />
      <div className="grid gap-3 lg:grid-cols-2">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
      </div>
    </div>
  )
}

function ChartPanelSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="border-line bg-surface rounded-2xl border p-5">
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-1.5 h-3 w-56" />
      <Skeleton className="mt-4 w-full rounded-xl" style={{ height }} />
    </div>
  )
}

/** Reports: a filter bar over a wide grid. */
export function ReportsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading reports">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <CardSkeleton key={index} lines={2} />
        ))}
      </div>
      <ChartPanelSkeleton height={260} />
    </div>
  )
}

/** Any settings form: a heading, then labelled fields. */
export function SettingsSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading settings">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-3.5 w-80" />
      </div>
      <div className="border-line bg-surface space-y-5 rounded-2xl border p-6">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index}>
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="mt-2 h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
    </div>
  )
}

/**
 * A single feedback or guest, while it loads.
 *
 * Shaped like the real record — the guest block, the ratings, the comment, the
 * follow-up column — so the page does not reflow when the data lands.
 */
export function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-3.5 w-40" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <div className="border-line bg-surface rounded-2xl border p-5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-11/12" />
            <Skeleton className="mt-2 h-4 w-3/5" />
          </div>
          <div className="border-line bg-surface rounded-2xl border p-5">
            <Skeleton className="h-3.5 w-24" />
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-7 w-28 rounded-full" />
              ))}
            </div>
          </div>
        </div>
        <CardSkeleton lines={5} />
      </div>
    </div>
  )
}
