import { describe, expect, it } from 'vitest'
import { significantGaps } from '@/lib/analytics/time-patterns'
import { HOUR_BUCKETS, dayOfWeek, hourBucket, localStamps, toLocalDate } from '@/lib/time'

describe('hourBucket — §33 service windows', () => {
  it('maps each service hour to its bucket', () => {
    const at = (iso: string) => hourBucket(new Date(iso))
    expect(at('2026-08-23T13:00:00+05:30')).toBe('12-15')
    expect(at('2026-08-23T16:30:00+05:30')).toBe('15-18')
    expect(at('2026-08-23T20:00:00+05:30')).toBe('18-21')
    expect(at('2026-08-23T22:45:00+05:30')).toBe('21-24')
  })

  it('puts everything outside service hours in "other"', () => {
    expect(hourBucket(new Date('2026-08-23T03:30:00+05:30'))).toBe('other')
    expect(hourBucket(new Date('2026-08-23T11:59:00+05:30'))).toBe('other')
  })

  it('uses Kolkata time, not the server clock', () => {
    // 22:00 UTC is 03:30 the next day in Kolkata.
    const instant = new Date('2026-08-23T22:00:00Z')
    expect(hourBucket(instant)).toBe('other')
    expect(toLocalDate(instant)).toBe('2026-08-24')
  })

  it('covers every bucket the schema allows', () => {
    expect(HOUR_BUCKETS).toEqual(['12-15', '15-18', '18-21', '21-24', 'other'])
  })
})

describe('dayOfWeek — matches Postgres EXTRACT(DOW)', () => {
  it('counts Sunday as 0', () => {
    // 2026-08-23 is a Sunday.
    expect(dayOfWeek(new Date('2026-08-23T13:00:00+05:30'))).toBe(0)
    expect(dayOfWeek(new Date('2026-08-24T13:00:00+05:30'))).toBe(1)
    expect(dayOfWeek(new Date('2026-08-29T13:00:00+05:30'))).toBe(6)
  })

  it('rolls the day over at Kolkata midnight, not UTC midnight', () => {
    // 20:00 UTC Saturday is 01:30 Sunday in Kolkata.
    expect(dayOfWeek(new Date('2026-08-22T20:00:00Z'))).toBe(0)
  })
})

describe('localStamps', () => {
  it('derives every denormalised column from one instant', () => {
    expect(localStamps(new Date('2026-08-23T19:45:00+05:30'))).toEqual({
      local_date: '2026-08-23',
      local_time: '19:45:00',
      day_of_week: 0,
      hour_bucket: '18-21',
    })
  })
})

describe('significantGaps — only claim a pattern when there is one', () => {
  const rows = [
    { label: '12 PM – 3 PM', average: 4.6, ratingCount: 40 },
    { label: '3 PM – 6 PM', average: 4.4, ratingCount: 30 },
    { label: '6 PM – 9 PM', average: 3.6, ratingCount: 55 },
    { label: '9 PM – 12 AM', average: 4.5, ratingCount: 25 },
  ]

  it('names the worst and best slots when the gap is worth acting on', () => {
    const gap = significantGaps(rows, 5)
    expect(gap).toEqual({ worst: '6 PM – 9 PM', best: '12 PM – 3 PM', gap: 1 })
  })

  it('says nothing when every slot is within noise of the others', () => {
    const flat = rows.map((row) => ({ ...row, average: 4.5 }))
    expect(significantGaps(flat, 5)).toBeNull()
  })

  it('ignores slots below the minimum sample size', () => {
    // The 6-9 PM dip is real but only has two ratings behind it.
    const thin = [
      { label: '12 PM – 3 PM', average: 4.6, ratingCount: 40 },
      { label: '6 PM – 9 PM', average: 2.0, ratingCount: 2 },
    ]
    expect(significantGaps(thin, 5)).toBeNull()
  })

  it('needs at least two eligible slots to compare', () => {
    expect(significantGaps([{ label: 'only one', average: 4.6, ratingCount: 40 }], 5)).toBeNull()
    expect(significantGaps([], 5)).toBeNull()
  })

  it('ignores slots with no ratings at all', () => {
    const withEmpty = [...rows, { label: 'Outside service hours', average: null, ratingCount: 0 }]
    expect(significantGaps(withEmpty, 5)?.worst).toBe('6 PM – 9 PM')
  })
})
