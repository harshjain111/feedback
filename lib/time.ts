/**
 * Asia/Kolkata time helpers — CLAUDE.md §13.5.
 *
 * ALL business logic goes through this module. Never call `new Date()` and read
 * `.getHours()` / `.getDay()` directly: the server runs in UTC on Vercel and the
 * kiosk tablet runs in whatever timezone it was configured with. Every date the
 * café reasons about ("today", "9 PM", "Saturday") is a Kolkata wall-clock date.
 */
import { formatInTimeZone } from 'date-fns-tz'

export const IST_TIMEZONE = 'Asia/Kolkata' as const

/** `hour_bucket` values — CLAUDE.md §7 / §33. */
export const HOUR_BUCKETS = ['12-15', '15-18', '18-21', '21-24', 'other'] as const
export type HourBucket = (typeof HOUR_BUCKETS)[number]

/**
 * The current instant.
 *
 * A `Date` is an absolute instant, not a wall-clock reading — there is no such
 * thing as a "Date in IST". Every conversion below applies IST at the moment of
 * formatting, which is the only correct way to do this.
 */
export function nowIST(): Date {
  return new Date()
}

/** Kolkata calendar date as `yyyy-MM-dd` — the `feedback.local_date` column. */
export function toLocalDate(instant: Date = nowIST()): string {
  return formatInTimeZone(instant, IST_TIMEZONE, 'yyyy-MM-dd')
}

/** Kolkata wall-clock time as `HH:mm:ss` — the `feedback.local_time` column. */
export function toLocalTime(instant: Date = nowIST()): string {
  return formatInTimeZone(instant, IST_TIMEZONE, 'HH:mm:ss')
}

/** Kolkata hour, 0–23. */
export function localHour(instant: Date = nowIST()): number {
  return Number(formatInTimeZone(instant, IST_TIMEZONE, 'H'))
}

/**
 * Day of week, 0 = Sunday … 6 = Saturday.
 *
 * Matches Postgres `EXTRACT(DOW FROM ...)` so SQL and TypeScript agree — §34
 * day-of-week comparison reads this column from both sides.
 */
export function dayOfWeek(instant: Date = nowIST()): number {
  return Number(formatInTimeZone(instant, IST_TIMEZONE, 'i')) % 7
}

/** Service-hour bucket for §33 time-of-day analysis. */
export function hourBucket(instant: Date = nowIST()): HourBucket {
  const hour = localHour(instant)
  if (hour >= 12 && hour < 15) return '12-15'
  if (hour >= 15 && hour < 18) return '15-18'
  if (hour >= 18 && hour < 21) return '18-21'
  if (hour >= 21 && hour < 24) return '21-24'
  return 'other'
}

/** Every denormalised time column for one submission, computed once. */
export function localStamps(instant: Date = nowIST()): {
  local_date: string
  local_time: string
  day_of_week: number
  hour_bucket: HourBucket
} {
  return {
    local_date: toLocalDate(instant),
    local_time: toLocalTime(instant),
    day_of_week: dayOfWeek(instant),
    hour_bucket: hourBucket(instant),
  }
}

/** Format an instant for display, in IST. Default: `23-Aug-2026, 7:42 PM`. */
export function formatIST(instant: Date, pattern = 'dd-MMM-yyyy, h:mm a'): string {
  return formatInTimeZone(instant, IST_TIMEZONE, pattern)
}
