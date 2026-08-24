import type { MemoryConfig, ScheduleWindow } from './config.types'

/**
 * The kill switch — PHOTO_MODULE.md §8b, all three layers.
 *
 * Pure functions with no I/O so the rules are unit-testable, because "is the
 * module on right now" is the one question in this feature that must never be
 * answered by accident. Three independent layers, and any of them being off
 * means off:
 *
 *   1. Master toggle. The module vanishes from the journey entirely.
 *   2. Auto-disable after N consecutive print failures.
 *   3. Optional schedule windows.
 *
 * Layer 2 is the one that earns its keep. A printer that jams at 9pm on a
 * Saturday otherwise keeps offering a gift it cannot deliver, to every guest,
 * until somebody notices — and nobody notices, because the failure is silent by
 * design (§7). Re-enable is manual: the system never quietly switches itself
 * back on, because the condition that broke it does not fix itself either.
 */

export type SwitchState = {
  enabled: boolean
  /** Which layer said no. Null when the module is on. */
  blockedBy: 'master' | 'failures' | 'schedule' | null
}

const ON: SwitchState = { enabled: true, blockedBy: null }

/** Minutes since midnight, in the café's own timezone. */
export function minutesOfDay(date: Date, timeZone = 'Asia/Kolkata'): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(date)

  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}

/** 0 = Sunday, in the café's own timezone. */
export function dayOfWeekIn(date: Date, timeZone = 'Asia/Kolkata'): number {
  const name = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone }).format(date)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name)
}

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

/**
 * Is `now` inside this window?
 *
 * Windows that wrap past midnight are supported — "21:00 to 01:00" is a real
 * thing a café asks for, and treating it as an empty range would silently turn
 * the module off for the busiest hour of the evening.
 */
export function isWithinWindow(window: ScheduleWindow, now: Date, timeZone?: string): boolean {
  const days = window.days ?? []
  if (days.length > 0 && !days.includes(dayOfWeekIn(now, timeZone))) return false

  const from = parseClock(window.from)
  const to = parseClock(window.to)
  // An unparseable window is ignored rather than treated as closed. A typo in
  // settings should not take the feature down.
  if (from === null || to === null) return false

  const minutes = minutesOfDay(now, timeZone)
  return from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to
}

/**
 * The whole question, in one place.
 *
 * `consecutiveFailures` comes from the alert/health layer rather than being
 * counted here, so this stays pure.
 */
export function memorySwitch(
  config: MemoryConfig,
  options: { now?: Date; consecutiveFailures?: number; timeZone?: string } = {},
): SwitchState {
  const { now = new Date(), consecutiveFailures = 0, timeZone } = options

  // Layer 1 first and unconditionally. When the master is off nothing else is
  // even evaluated — there is no state in which a schedule or a failure count
  // can turn the module back on.
  if (!config.enabled) return { enabled: false, blockedBy: 'master' }

  // Layer 2.
  if (config.auto_disable_on_failure && consecutiveFailures >= config.failure_threshold) {
    return { enabled: false, blockedBy: 'failures' }
  }

  // Layer 3. Off by default; an enabled schedule with no windows means "never",
  // which is a strange thing to configure but an unambiguous one.
  if (config.schedule_enabled) {
    const open = config.schedule_windows.some((window) => isWithinWindow(window, now, timeZone))
    if (!open) return { enabled: false, blockedBy: 'schedule' }
  }

  return ON
}

/** What to tell a manager, on the device-health badge. Never shown to a guest. */
export const BLOCKED_LABELS: Record<NonNullable<SwitchState['blockedBy']>, string> = {
  master: 'Memory prints are switched off',
  failures: 'Memory prints auto-disabled after repeated print failures',
  schedule: 'Memory prints are outside their scheduled hours',
}
