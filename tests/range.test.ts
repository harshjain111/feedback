import { describe, expect, it } from 'vitest'
import {
  comparisonLabel,
  parseRange,
  rangeForPreset,
  rangeLengthDays,
  rangeToParams,
} from '@/lib/range'

const TODAY = '2026-08-23'

describe('rangeForPreset', () => {
  it('resolves each preset against the café’s today', () => {
    expect(rangeForPreset('today', TODAY)).toEqual({
      preset: 'today',
      from: '2026-08-23',
      to: '2026-08-23',
    })
    expect(rangeForPreset('yesterday', TODAY)).toEqual({
      preset: 'yesterday',
      from: '2026-08-22',
      to: '2026-08-22',
    })
  })

  it('counts 7 days inclusive of today, not 8', () => {
    const range = rangeForPreset('7d', TODAY)
    expect(range).toEqual({ preset: '7d', from: '2026-08-17', to: '2026-08-23' })
    expect(rangeLengthDays(range)).toBe(7)
  })

  it('counts 30 days inclusive of today', () => {
    const range = rangeForPreset('30d', TODAY)
    expect(range.from).toBe('2026-07-25')
    expect(rangeLengthDays(range)).toBe(30)
  })

  it('crosses a month boundary correctly', () => {
    // 2026 is not a leap year: Feb 25–Mar 3 inclusive is seven days.
    const range = rangeForPreset('7d', '2026-03-03')
    expect(range.from).toBe('2026-02-25')
    expect(rangeLengthDays(range)).toBe(7)
  })

  it('handles a leap day', () => {
    expect(rangeForPreset('yesterday', '2028-03-01').from).toBe('2028-02-29')
  })
})

describe('parseRange', () => {
  it('defaults to today with no params', () => {
    expect(parseRange({}, TODAY).preset).toBe('today')
  })

  it('reads a preset from the URL', () => {
    expect(parseRange({ range: '30d' }, TODAY).from).toBe('2026-07-25')
  })

  it('degrades a nonsense preset to today rather than throwing', () => {
    expect(parseRange({ range: 'last-tuesday' }, TODAY).preset).toBe('today')
    expect(parseRange({ range: ['a', 'b'] }, TODAY).preset).toBe('today')
  })

  it('reads a custom window', () => {
    expect(parseRange({ range: 'custom', from: '2026-08-01', to: '2026-08-07' }, TODAY)).toEqual({
      preset: 'custom',
      from: '2026-08-01',
      to: '2026-08-07',
    })
  })

  it('tolerates a reversed custom pair instead of returning an empty window', () => {
    expect(parseRange({ range: 'custom', from: '2026-08-07', to: '2026-08-01' }, TODAY)).toEqual({
      preset: 'custom',
      from: '2026-08-01',
      to: '2026-08-07',
    })
  })

  it('ignores malformed custom dates', () => {
    const range = parseRange({ range: 'custom', from: 'yesterday', to: '' }, TODAY)
    expect(range.from).toBe(TODAY)
    expect(range.to).toBe(TODAY)
  })
})

describe('rangeToParams', () => {
  it('omits from/to for a preset', () => {
    expect(rangeToParams(rangeForPreset('7d', TODAY)).toString()).toBe('range=7d')
  })

  it('carries from/to for a custom window, and round-trips', () => {
    const original = parseRange({ range: 'custom', from: '2026-08-01', to: '2026-08-07' }, TODAY)
    const params = rangeToParams(original)
    expect(parseRange(Object.fromEntries(params.entries()), TODAY)).toEqual(original)
  })
})

describe('comparisonLabel — never a bare number (§9)', () => {
  it('names the window being compared against', () => {
    expect(comparisonLabel(rangeForPreset('today', TODAY))).toBe('vs yesterday')
    expect(comparisonLabel(rangeForPreset('7d', TODAY))).toBe('vs previous 7 days')
    expect(comparisonLabel(rangeForPreset('30d', TODAY))).toBe('vs previous 30 days')
  })
})
