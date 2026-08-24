import { describe, expect, it } from 'vitest'
import { dayOfWeekIn, isWithinWindow, memorySwitch, minutesOfDay } from '@/lib/memory-switch'
import { CONFIG_DEFAULTS } from '@/lib/config.defaults'
import type { MemoryConfig } from '@/lib/config.types'

const base: MemoryConfig = CONFIG_DEFAULTS.memory

/** 2026-08-24 is a Monday. Times given in UTC; the café is UTC+5:30. */
const at = (iso: string) => new Date(iso)

describe('layer 1 — the master toggle', () => {
  it('is the only thing that matters when it is off', () => {
    // No schedule, no failure count, nothing can turn the module back on.
    const state = memorySwitch(
      { ...base, enabled: false, schedule_enabled: true, auto_disable_on_failure: true },
      { consecutiveFailures: 0 },
    )
    expect(state).toEqual({ enabled: false, blockedBy: 'master' })
  })

  it('lets the module run when everything else is at its default', () => {
    expect(memorySwitch(base)).toEqual({ enabled: true, blockedBy: null })
  })
})

describe('layer 2 — auto-disable on failures', () => {
  it('trips at the threshold, not one short of it', () => {
    expect(memorySwitch(base, { consecutiveFailures: 2 }).enabled).toBe(true)
    expect(memorySwitch(base, { consecutiveFailures: 3 })).toEqual({
      enabled: false,
      blockedBy: 'failures',
    })
  })

  it('does nothing when auto-disable is switched off', () => {
    // The café may prefer to be told rather than to have the feature vanish.
    expect(
      memorySwitch({ ...base, auto_disable_on_failure: false }, { consecutiveFailures: 99 }).enabled,
    ).toBe(true)
  })

  it('is what stops a jam at 9pm becoming an evening of them', () => {
    // The reason this layer exists: the failure is silent to the guest by
    // design (§7), so nobody reports it and every subsequent guest is offered a
    // gift the printer cannot deliver.
    const jammed = memorySwitch(base, { consecutiveFailures: 5 })
    expect(jammed.enabled).toBe(false)
    expect(jammed.blockedBy).toBe('failures')
  })
})

describe('layer 3 — schedule windows', () => {
  const evenings = {
    ...base,
    schedule_enabled: true,
    schedule_windows: [{ days: [], from: '18:00', to: '23:00' }],
  }

  it('is off by default, so nobody has to think about it', () => {
    expect(base.schedule_enabled).toBe(false)
    expect(base.schedule_windows).toEqual([])
  })

  it('opens and closes on the café clock, not UTC', () => {
    // 13:00 UTC is 18:30 in Kolkata — inside the window.
    expect(memorySwitch(evenings, { now: at('2026-08-24T13:00:00Z') }).enabled).toBe(true)
    // 06:00 UTC is 11:30 in Kolkata — outside it.
    expect(memorySwitch(evenings, { now: at('2026-08-24T06:00:00Z') })).toEqual({
      enabled: false,
      blockedBy: 'schedule',
    })
  })

  it('handles a window that wraps past midnight', () => {
    // "21:00 to 01:00" is a real thing a café asks for. Treating it as an empty
    // range would silently kill the busiest hour of the evening.
    const lateNight = {
      ...base,
      schedule_enabled: true,
      schedule_windows: [{ days: [], from: '21:00', to: '01:00' }],
    }
    // 16:00 UTC = 21:30 IST — inside.
    expect(memorySwitch(lateNight, { now: at('2026-08-24T16:00:00Z') }).enabled).toBe(true)
    // 19:00 UTC = 00:30 IST next day — still inside.
    expect(memorySwitch(lateNight, { now: at('2026-08-24T19:00:00Z') }).enabled).toBe(true)
    // 09:00 UTC = 14:30 IST — outside.
    expect(memorySwitch(lateNight, { now: at('2026-08-24T09:00:00Z') }).enabled).toBe(false)
  })

  it('respects a day restriction', () => {
    // Weekends only. 2026-08-24 is a Monday.
    const weekends = {
      ...base,
      schedule_enabled: true,
      schedule_windows: [{ days: [0, 6], from: '00:00', to: '23:59' }],
    }
    expect(memorySwitch(weekends, { now: at('2026-08-24T13:00:00Z') }).enabled).toBe(false)
    // 2026-08-29 is a Saturday.
    expect(memorySwitch(weekends, { now: at('2026-08-29T13:00:00Z') }).enabled).toBe(true)
  })

  it('ignores an unparseable window rather than taking the feature down', () => {
    // A typo in settings should not be a silent outage. It fails closed for
    // that window only, and any other valid window still opens.
    const typo = {
      ...base,
      schedule_enabled: true,
      schedule_windows: [
        { days: [], from: 'six pm', to: '23:00' },
        { days: [], from: '00:00', to: '23:59' },
      ],
    }
    expect(memorySwitch(typo, { now: at('2026-08-24T13:00:00Z') }).enabled).toBe(true)
  })
})

describe('the layers compose', () => {
  it('reports the FIRST layer that says no, in priority order', () => {
    // Master beats failures beats schedule. A manager looking at the badge
    // should be told the thing they can act on first.
    const everything = {
      ...base,
      enabled: false,
      auto_disable_on_failure: true,
      schedule_enabled: true,
      schedule_windows: [],
    }
    expect(memorySwitch(everything, { consecutiveFailures: 99 }).blockedBy).toBe('master')

    expect(
      memorySwitch({ ...everything, enabled: true }, { consecutiveFailures: 99 }).blockedBy,
    ).toBe('failures')

    expect(
      memorySwitch({ ...everything, enabled: true }, { consecutiveFailures: 0 }).blockedBy,
    ).toBe('schedule')
  })
})

describe('timezone helpers', () => {
  it('reads the clock in Kolkata, not the server locale', () => {
    // The server is UTC on Vercel and IST on the kiosk. Both must agree.
    expect(minutesOfDay(at('2026-08-24T13:00:00Z'))).toBe(18 * 60 + 30)
    expect(minutesOfDay(at('2026-08-24T19:00:00Z'))).toBe(30) // 00:30 next day
  })

  it('rolls the day over at Kolkata midnight', () => {
    // 2026-08-24 is a Monday. 19:00 UTC is already Tuesday there.
    expect(dayOfWeekIn(at('2026-08-24T13:00:00Z'))).toBe(1)
    expect(dayOfWeekIn(at('2026-08-24T19:00:00Z'))).toBe(2)
  })

  it('never reports a window as open on a bad clock string', () => {
    for (const bad of ['', '25:00', '12:99', 'noon', '9pm']) {
      expect(isWithinWindow({ days: [], from: bad, to: '23:00' }, new Date()), bad).toBe(false)
    }
  })
})
