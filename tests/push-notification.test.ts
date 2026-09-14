import { describe, expect, it } from 'vitest'
import { lowRatingNotification } from '@/lib/push-copy'

/**
 * The notification a phone actually shows.
 *
 * Pure and deterministic, so it is worth pinning: the wording is the whole
 * product here. A manager glancing at a lock screen either walks to the table
 * or does not, and that decision is made entirely from these two strings.
 *
 * Delivery itself is not tested here — that needs a live push service and a
 * real browser subscription, which would make the suite depend on Google being
 * up. It was verified by hand against FCM (HTTP 201) when this was built.
 */

const base = {
  feedbackId: 'f1e2d3c4-0000-0000-0000-000000000001',
  guestName: 'Aayush',
  comment: null,
  worst: { categoryName: 'FOOD', rating: 1 },
  lowCount: 1,
}

describe('the low-rating notification', () => {
  it('names the guest, the category and the score', () => {
    const push = lowRatingNotification(base)
    expect(push.title).toBe('Aayush rated FOOD 1/5')
  })

  it('counts the other low categories rather than sending one push each', () => {
    // A guest who rates food 1, service 2 and hospitality 2 has had ONE bad
    // visit. Three buzzes in the same second teaches people to swipe them away.
    expect(lowRatingNotification({ ...base, lowCount: 3 }).title).toBe(
      'Aayush rated FOOD 1/5 and 2 others',
    )
    expect(lowRatingNotification({ ...base, lowCount: 2 }).title).toBe(
      'Aayush rated FOOD 1/5 and 1 other',
    )
  })

  it('falls back to "A guest" when no name was given', () => {
    expect(lowRatingNotification({ ...base, guestName: null }).title).toMatch(/^A guest rated/)
    // A name of spaces is not a name.
    expect(lowRatingNotification({ ...base, guestName: '   ' }).title).toMatch(/^A guest rated/)
  })

  it("leads with the guest's own words when there are any", () => {
    const push = lowRatingNotification({ ...base, comment: 'Food was cold and nobody came back.' })
    expect(push.body).toBe('Food was cold and nobody came back.')
  })

  it('truncates a long comment rather than letting the OS cut it mid-word', () => {
    const long = 'x'.repeat(400)
    const push = lowRatingNotification({ ...base, comment: long })
    // The contract is "short enough for a lock screen, and visibly cut" — not
    // an exact count. Android shows roughly this much before eliding anyway.
    expect(push.body.length).toBeLessThanOrEqual(160)
    expect(push.body.endsWith('…')).toBe(true)
    // A comment that fits is passed through untouched, ellipsis and all.
    const short = lowRatingNotification({ ...base, comment: 'Cold food.' })
    expect(short.body).toBe('Cold food.')
  })

  it('says so plainly when there is no comment', () => {
    expect(lowRatingNotification(base).body).toMatch(/No comment left/)
  })

  it('deep-links to that feedback, and tags on it so repeats collapse', () => {
    const push = lowRatingNotification(base)
    expect(push.url).toBe(`/admin/feedback/${base.feedbackId}`)
    // Same tag for the same feedback: a retry replaces the notification on the
    // device instead of adding a second one.
    expect(push.tag).toBe(`feedback:${base.feedbackId}`)
  })
})
