import { describe, expect, it } from 'vitest'
import { emptyDraft } from '@/lib/session'
import {
  canKeepContact,
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

describe('canKeepContact — what enables KEEP ME CONNECTED', () => {
  it('is false for an empty form', () => {
    expect(canKeepContact('')).toBe(false)
    expect(canKeepContact('   ')).toBe(false)
  })

  it('is false for a half-typed number', () => {
    expect(canKeepContact('98')).toBe(false)
    expect(canKeepContact('98765')).toBe(false)
    expect(canKeepContact('987654321')).toBe(false)
  })

  it('is false for ten digits that are not a mobile number', () => {
    expect(canKeepContact('1234567890')).toBe(false)
    expect(canKeepContact('5000000000')).toBe(false)
  })

  it('is true once a valid number is there, however it was typed', () => {
    expect(canKeepContact('9876543210')).toBe(true)
    expect(canKeepContact('+91 98765 43210')).toBe(true)
    expect(canKeepContact('098765-43210')).toBe(true)
  })

  it('agrees with isValidPhone, so the button and the submit cannot disagree', () => {
    for (const value of ['', '98', '1234567890', '9876543210', '+919876543210']) {
      expect(canKeepContact(value), value).toBe(value.trim() !== '' && isValidPhone(value))
    }
  })
})

describe('the draft never carries a photograph', () => {
  it('has no field an image could be parked in', () => {
    // Rule 2, as a structural test. sessionStorage is written to disk by the
    // browser, so a base64 frame in the draft IS the photo written to the
    // machine. The frame lives in a React ref inside the /memory route and dies
    // with the page; if a field named like image data ever appears here, that
    // has stopped being true.
    const keys = Object.keys(emptyDraft())

    for (const key of keys) {
      expect(key, `draft.${key} looks like it holds image data`).not.toMatch(
        /photo|image|jpeg|jpg|png|frame|capture|selfie|snapshot/i,
      )
    }
  })

  it('carries the feedback code that gates the camera', () => {
    // Rule 1's mechanism: /memory mounts only when this is set, and it is set
    // only after POST /api/feedback returns.
    expect(emptyDraft().feedbackCode).toBeNull()
  })
})

describe('what a compulsory contact screen may and may not do', () => {
  it('accepts exactly the numbers the submit can store', () => {
    // The gate and the guest key have to agree. If the button accepted
    // something POST /api/feedback would not attach a guest to, a guest would
    // be forced to hand over a number that then went nowhere.
    for (const value of ['9876543210', '+91 98765 43210', '098765-43210']) {
      expect(canKeepContact(value), value).toBe(true)
      expect(isValidPhone(value), value).toBe(true)
    }
  })

  it('never lets a name alone satisfy it', () => {
    // A name is not a contact detail: guest resolution keys on the phone (§7),
    // so a name with no number stores nothing and reaches nobody. Requiring the
    // screen and then accepting a name would be theatre.
    expect(canKeepContact('')).toBe(false)
    expect(canKeepContact('   ')).toBe(false)
  })
})
