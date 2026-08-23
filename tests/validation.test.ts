import { describe, expect, it } from 'vitest'
import {
  combineComments,
  feedbackSubmissionSchema,
  isValidPhone,
  normalisePhone,
} from '@/lib/validation'

describe('phone handling', () => {
  it('strips +91, spaces, dashes and a leading 0', () => {
    expect(normalisePhone('+91 98765 43210')).toBe('9876543210')
    expect(normalisePhone('098765-43210')).toBe('9876543210')
    expect(normalisePhone('9876543210')).toBe('9876543210')
  })

  it('accepts a 10-digit mobile starting 6-9', () => {
    for (const value of ['9876543210', '6000000000', '7123456789', '8999999999']) {
      expect(isValidPhone(value), value).toBe(true)
    }
  })

  it('rejects landlines, short numbers and junk', () => {
    for (const value of ['1234567890', '5876543210', '98765', '98765432101', 'abcdefghij']) {
      expect(isValidPhone(value), value).toBe(false)
    }
  })
})

describe('feedbackSubmissionSchema', () => {
  const base = {
    submissionId: '11111111-1111-4111-8111-111111111111',
    ratings: { 'cat-1': 5, 'cat-2': 2 },
  }

  it('accepts a minimal submission and defaults the rest', () => {
    const parsed = feedbackSubmissionSchema.parse(base)
    expect(parsed.issueIds).toEqual([])
    expect(parsed.comment).toBe('')
    expect(parsed.followUpRequested).toBeNull()
    expect(parsed.phone).toBe('')
  })

  it('requires the idempotency key', () => {
    expect(feedbackSubmissionSchema.safeParse({ ratings: base.ratings }).success).toBe(false)
    expect(
      feedbackSubmissionSchema.safeParse({ ...base, submissionId: 'not-a-uuid' }).success,
    ).toBe(false)
  })

  it('rejects a rating outside 1..5, matching the DB CHECK', () => {
    expect(feedbackSubmissionSchema.safeParse({ ...base, ratings: { a: 0 } }).success).toBe(false)
    expect(feedbackSubmissionSchema.safeParse({ ...base, ratings: { a: 6 } }).success).toBe(false)
    expect(feedbackSubmissionSchema.safeParse({ ...base, ratings: { a: 3.5 } }).success).toBe(false)
  })

  it('accepts an empty phone but rejects a typed-but-wrong one', () => {
    expect(feedbackSubmissionSchema.safeParse({ ...base, phone: '' }).success).toBe(true)
    expect(feedbackSubmissionSchema.safeParse({ ...base, phone: '   ' }).success).toBe(true)
    expect(feedbackSubmissionSchema.safeParse({ ...base, phone: '12345' }).success).toBe(false)
  })

  it('normalises the phone it stores', () => {
    const parsed = feedbackSubmissionSchema.parse({ ...base, phone: '+91 98765 43210' })
    expect(parsed.phone).toBe('9876543210')
  })

  it('never requires a name', () => {
    expect(feedbackSubmissionSchema.safeParse({ ...base, name: '' }).success).toBe(true)
  })
})

describe('combineComments — §14.10, nothing is dropped', () => {
  it('returns null when the guest wrote nothing', () => {
    expect(combineComments('', '')).toBeNull()
    expect(combineComments('   ', '  ')).toBeNull()
  })

  it('returns a single text unchanged', () => {
    expect(combineComments('Waited 40 minutes', '')).toBe('Waited 40 minutes')
    expect(combineComments('', 'Lovely evening')).toBe('Lovely evening')
  })

  it('keeps BOTH texts verbatim when a negative journey produced two', () => {
    const combined = combineComments('The dosa was cold.', 'Otherwise a lovely evening.')
    expect(combined).toBe('The dosa was cold.\n\nOtherwise a lovely evening.')
    expect(combined).toContain('The dosa was cold.')
    expect(combined).toContain('Otherwise a lovely evening.')
  })
})
