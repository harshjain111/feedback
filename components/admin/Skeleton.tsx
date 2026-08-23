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

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-lg', className)}
      style={{ background: 'var(--color-ground-sunk)' }}
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
